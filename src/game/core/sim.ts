import { Rng } from '../../engine/rng';
import { GAME, VW, VH, CEIL_Y, FLOOR_Y, CEIL_LINE, FLOOR_LINE } from './config';
import { clamp, circleRectGap } from './geom';
import { nextObstacle, type Obstacle } from './world';

/** Fixed logic step. The engine loop is locked to 60Hz. */
export const TICK = 1 / 60;

export interface TickEvents {
  died: boolean;
  nearMiss: number;
  pickup: number;
}

export interface SimOptions {
  /** Record the tick index of every flip (for ghost replay / anti-cheat log). */
  record?: boolean;
  /** Replay these flip tick-indices instead of taking live input. */
  replay?: readonly number[];
}

/**
 * The full FLIP simulation — deterministic and headless (no canvas). A tap
 * flips gravity; the comet falls to the opposite surface. Gates force surface
 * commitment, spikes force flip-aways, near misses build a combo multiplier.
 *
 * Same seed + same flip ticks ⇒ byte-identical run on any device. This is what
 * makes the daily run shared worldwide and ghost replays desync-free.
 */
export class FlipSim {
  readonly seed: string;

  // comet
  y = FLOOR_Y;
  vy = 0;
  gravitySign: 1 | -1 = 1; // +1 → floor, -1 → ceiling

  // previous-tick state for render interpolation
  prevY = FLOOR_Y;
  prevDistance = 0;

  // run state
  alive = true;
  distance = 0; // virtual px travelled
  bonus = 0; // pickup + near-miss points
  nearMisses = 0;
  pickupsCollected = 0;
  combo = 0;
  multiplier = 1;
  elapsed = 0;

  readonly obstacles: Obstacle[] = [];

  private readonly rng: Rng;
  private tickIndex = 0;
  private lastSpawnX = 0;
  private comboTimer = 0;

  private readonly recording: boolean;
  private readonly flipLog: number[] = [];
  private readonly replaySet: Set<number> | null;

  constructor(seed: string, opts: SimOptions = {}) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.recording = opts.record ?? false;
    this.replaySet = opts.replay ? new Set(opts.replay) : null;
    this.lastSpawnX = VW * 1.4; // a beat before the first obstacle
    this.fill();
  }

  get speed(): number {
    const t = clamp(this.elapsed / GAME.rampSeconds, 0, 1);
    const eased = t * t;
    return GAME.baseSpeed + (GAME.maxSpeed - GAME.baseSpeed) * eased;
  }

  get gap(): number {
    const t = clamp(this.elapsed / GAME.rampSeconds, 0, 1);
    const eased = t * t;
    return GAME.baseGap + (GAME.minGap - GAME.baseGap) * eased;
  }

  get score(): number {
    return Math.floor(this.distance / GAME.distanceDivisor) + this.bonus;
  }

  get cameraX(): number {
    return this.distance;
  }

  getFlipLog(): readonly number[] {
    return this.flipLog;
  }

  /** Live input: flip gravity now. */
  flip(): void {
    if (!this.alive) return;
    if (this.replaySet) return; // replay drives itself
    this.gravitySign = (this.gravitySign * -1) as 1 | -1;
    if (this.recording) this.flipLog.push(this.tickIndex);
  }

  /** Interpolated comet Y for smooth rendering between ticks. */
  renderY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha;
  }

  /** Interpolated camera X for smooth horizontal scroll. */
  renderCameraX(alpha: number): number {
    return this.prevDistance + (this.distance - this.prevDistance) * alpha;
  }

  tick(): TickEvents {
    const ev: TickEvents = { died: false, nearMiss: 0, pickup: 0 };
    if (!this.alive) return ev;

    this.prevY = this.y;
    this.prevDistance = this.distance;

    // replayed flips happen at the same tick boundary as live ones
    if (this.replaySet?.has(this.tickIndex)) {
      this.gravitySign = (this.gravitySign * -1) as 1 | -1;
    }

    // physics
    this.vy += GAME.gravity * this.gravitySign * TICK;
    this.y += this.vy * TICK;
    if (this.gravitySign > 0 && this.y >= FLOOR_Y) {
      this.y = FLOOR_Y;
      this.vy = 0;
    } else if (this.gravitySign < 0 && this.y <= CEIL_Y) {
      this.y = CEIL_Y;
      this.vy = 0;
    }
    this.y = clamp(this.y, CEIL_Y, FLOOR_Y);

    // advance world
    const spd = this.speed;
    this.distance += spd * TICK;
    this.elapsed += TICK;
    this.fill();

    this.collide(ev);
    this.updateCombo(ev);

    this.tickIndex++;
    return ev;
  }

  // ---- internals ----------------------------------------------------------

  private fill(): void {
    const ahead = this.cameraX + VW * 2;
    while (this.lastSpawnX < ahead) {
      const o = nextObstacle(this.rng, this.lastSpawnX, this.gap, this.speed);
      this.lastSpawnX = o.x;
      this.obstacles.push(o);
    }
    // prune obstacles fully behind the camera
    while (this.obstacles.length && this.obstacles[0]!.x - this.cameraX < -GAME.wallW - 40) {
      this.obstacles.shift();
    }
  }

  private collide(ev: TickEvents): void {
    const cx = GAME.cometX;
    const r = GAME.cometR;
    for (const o of this.obstacles) {
      const sx = o.x - this.cameraX;
      if (sx + GAME.wallW < -20 || sx > VW + 40) continue;

      let clear = Infinity;
      if (o.kind === 'gate') {
        const gTop = circleRectGap(cx, this.y, r, sx, 0, GAME.wallW, o.gapTop);
        const gBot = circleRectGap(
          cx,
          this.y,
          r,
          sx,
          o.gapBottom,
          GAME.wallW,
          VH - o.gapBottom + 40,
        );
        clear = Math.min(gTop, gBot);
      } else {
        const ry = o.surface === 'floor' ? FLOOR_LINE - o.height : CEIL_LINE;
        clear = circleRectGap(cx, this.y, r, sx, ry, GAME.wallW, o.height);
      }

      if (clear <= 0) {
        this.alive = false;
        ev.died = true;
      }
      // track closest approach while alongside the comet's column
      if (sx < cx + 70 && sx + GAME.wallW > cx - 70) {
        o.minClear = Math.min(o.minClear, clear);
      }
      // register a near miss when the obstacle passes cleanly but close
      if (!o.passed && sx + GAME.wallW < cx - r) {
        o.passed = true;
        if (this.alive && o.minClear > 0 && o.minClear <= GAME.nearMissThreshold) {
          ev.nearMiss++;
        }
      }

      // pickups
      if (o.pickup && !o.pickup.taken) {
        const psx = o.pickup.x - this.cameraX;
        if (Math.hypot(cx - psx, this.y - o.pickup.y) <= r + GAME.pickupR) {
          o.pickup.taken = true;
          ev.pickup++;
        }
      }
    }
  }

  private updateCombo(ev: TickEvents): void {
    if (ev.nearMiss > 0) {
      this.combo += ev.nearMiss;
      this.multiplier = clamp(1 + this.combo, 1, GAME.maxMultiplier);
      this.comboTimer = GAME.comboWindow;
      this.nearMisses += ev.nearMiss;
      this.bonus += GAME.nearMissBase * this.multiplier * ev.nearMiss;
    } else if (this.combo > 0) {
      this.comboTimer -= TICK;
      if (this.comboTimer <= 0) {
        this.combo = Math.max(0, this.combo - 1);
        this.multiplier = clamp(1 + this.combo, 1, GAME.maxMultiplier);
        this.comboTimer = GAME.comboWindow;
      }
    }
    if (ev.pickup > 0) {
      this.pickupsCollected += ev.pickup;
      this.bonus += GAME.pickupValue * this.multiplier * ev.pickup;
    }
  }
}
