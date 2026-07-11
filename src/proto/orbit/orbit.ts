import type { AppContext } from '../../engine/types';
import type { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
import type { Mechanic, RampState, StepResult } from '../shared/mechanic';
import { clamp } from '../shared/math';
import { ORBIT, ORBIT_CONFIG } from './config';

interface Anchor {
  worldX: number;
  y: number;
  radius: number;
  dir: 1 | -1;
  used: boolean;
}

/** Pure anchor generator — exported for the determinism test. */
export function nextAnchor(rng: Rng, worldX: number, height: number): Anchor {
  return {
    worldX,
    y: rng.range(ORBIT.yMargin, height - ORBIT.yMargin),
    radius: rng.range(ORBIT.radiusMin, ORBIT.radiusMax),
    dir: rng.bool() ? 1 : -1,
    used: false,
  };
}

/**
 * ORBIT — the comet orbits an anchor; tap to release along the current
 * tangent and coast to the next anchor. Auto-scroll creates forward pressure:
 * linger on an anchor and the camera leaves you behind. Timing the release arc
 * is everything.
 */
export class OrbitMechanic implements Mechanic {
  readonly cfg = ORBIT_CONFIG;

  private rng!: Rng;
  private cameraX = 0;
  private anchors: Anchor[] = [];
  private lastSpawnX = 0;

  // comet state
  private orbiting = true;
  private current: Anchor | null = null;
  private theta = 0;
  private wx = 0; // world x
  private wy = 0;
  private prevScreenX = 0;
  private prevY = 0;
  private vx = 0;
  private vy = 0;

  reset(rng: Rng, ctx: AppContext): void {
    this.rng = rng;
    this.cameraX = 0;
    this.anchors = [];
    this.lastSpawnX = 0;

    const first: Anchor = {
      worldX: ctx.width * ORBIT.startLead,
      y: ctx.height * 0.5,
      radius: (ORBIT.radiusMin + ORBIT.radiusMax) / 2,
      dir: 1,
      used: true,
    };
    this.anchors.push(first);
    this.lastSpawnX = first.worldX;
    this.current = first;
    this.orbiting = true;
    this.theta = Math.PI; // start on the left side of the anchor
    this.syncOrbitPos();
    this.prevScreenX = this.wx - this.cameraX;
    this.prevY = this.wy;
    this.fill(ctx);
  }

  onPress(): void {
    if (!this.orbiting || !this.current) return;
    // release along the tangent
    const a = this.current;
    const speed = a.radius * ORBIT.omega;
    const tx = -Math.sin(this.theta) * a.dir;
    const ty = Math.cos(this.theta) * a.dir;
    this.vx = tx * speed + ORBIT.launchBoost;
    this.vy = ty * speed;
    this.orbiting = false;
    this.current.used = true;
  }

  onRelease(): void {
    /* one-touch: release-from-orbit is on press */
  }

  update(dt: number, ramp: RampState, ctx: AppContext): StepResult {
    this.cameraX += ramp.speed * dt;
    this.prevScreenX = this.wx - this.cameraX;
    this.prevY = this.wy;

    let nearMisses = 0;
    let dead = false;
    const captureR = ramp.gap;

    if (this.orbiting && this.current) {
      this.theta += ORBIT.omega * this.current.dir * dt;
      this.syncOrbitPos();
    } else {
      this.wx += this.vx * dt;
      this.wy += this.vy * dt;
      // try to catch the next eligible anchor
      for (const a of this.anchors) {
        if (a.used || a.worldX <= this.cameraX) continue;
        const d = Math.hypot(a.worldX - this.wx, a.y - this.wy);
        if (d <= captureR + a.radius) {
          this.current = a;
          a.used = true;
          this.orbiting = true;
          this.theta = Math.atan2(this.wy - a.y, this.wx - a.worldX);
          // clutch catch near the edge of capture → near miss
          if (d >= captureR + a.radius - this.cfg.nearMissThresholdPx) nearMisses++;
          break;
        }
      }
    }

    this.fill(ctx);

    const screenX = this.wx - this.cameraX;
    if (this.wy < 0 || this.wy > ctx.height) dead = true;
    if (screenX < 0) dead = true; // camera left the comet behind

    return { advanced: ramp.speed * dt, pickups: 0, nearMisses, dead };
  }

  render(alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.fillStyle = PALETTE.bg;
    c.fillRect(0, 0, w, h);

    // anchors + capture rings
    for (const a of this.anchors) {
      const sx = a.worldX - this.cameraX;
      if (sx < -40 || sx > w + 40) continue;
      c.strokeStyle = 'rgba(123,131,166,0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(sx, a.y, a.radius, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = a.used ? PALETTE.dim : PALETTE.fg;
      c.beginPath();
      c.arc(sx, a.y, ORBIT.anchorR, 0, Math.PI * 2);
      c.fill();
    }

    // tether while orbiting
    const drawX = this.prevScreenX + (this.wx - this.cameraX - this.prevScreenX) * alpha;
    const drawY = this.prevY + (this.wy - this.prevY) * alpha;
    if (this.orbiting && this.current) {
      const ax = this.current.worldX - this.cameraX;
      c.strokeStyle = 'rgba(77,225,193,0.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ax, this.current.y);
      c.lineTo(drawX, drawY);
      c.stroke();
    }

    // comet
    c.fillStyle = PALETTE.accent;
    c.beginPath();
    c.arc(drawX, drawY, ORBIT.cometR, 0, Math.PI * 2);
    c.fill();
  }

  private syncOrbitPos(): void {
    const a = this.current;
    if (!a) return;
    this.wx = a.worldX + Math.cos(this.theta) * a.radius;
    this.wy = a.y + Math.sin(this.theta) * a.radius;
  }

  private fill(ctx: AppContext): void {
    const ahead = this.cameraX + ctx.width * 2;
    while (this.lastSpawnX < ahead) {
      this.lastSpawnX += this.rng.range(ORBIT.spawnMinGap, ORBIT.spawnMaxGap);
      this.anchors.push(nextAnchor(this.rng, this.lastSpawnX, ctx.height));
    }
    this.anchors = this.anchors.filter((a) => a.worldX - this.cameraX > -60);
    // keep bounds sane
    this.wy = clamp(this.wy, -40, ctx.height + 40);
  }
}
