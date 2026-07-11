import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
import { Backdrop } from '../../ui/backdrop';
import { CometTrail, drawComet } from '../../ui/comet';
import type { Mechanic } from './mechanic';
import { computeRamp } from './ramp';
import { recordRun } from './telemetry';

export type SeedProvider = () => string;

type RunState = 'playing' | 'dead';

/**
 * Shared prototype run harness. Owns the run lifecycle common to all three
 * prototypes: seeded reset, difficulty ramp, scoring (distance + pickups +
 * near-miss bonus), instant tap-to-restart, per-run telemetry, and the HUD.
 * The mechanic supplies only world + physics + graybox rendering.
 */
export class PrototypeScene implements Scene {
  readonly name = 'play';

  private state: RunState = 'playing';
  private rng: Rng;
  private elapsed = 0;
  private distance = 0;
  private pickups = 0;
  private nearMisses = 0;
  private runStartMs = 0;
  private runEndMs = 0;

  // session aggregates for deaths-per-minute
  private deaths = 0;
  private totalPlayMs = 0;
  private bestScore = 0;

  // juice / visuals
  private combo = 0;
  private newBest = false;
  private readonly backdrop = new Backdrop();
  private readonly trail = new CometTrail(18);

  constructor(
    private readonly mech: Mechanic,
    private readonly seedProvider: SeedProvider,
  ) {
    this.rng = new Rng(seedProvider());
  }

  /** Current run state — exposed for automated stability tests. */
  get phase(): RunState {
    return this.state;
  }

  /** Total deaths this session — exposed for automated stability tests. */
  get deathCount(): number {
    return this.deaths;
  }

  enter(_prev: string | undefined, ctx: AppContext): void {
    this.startRun(ctx);
  }

  private startRun(ctx: AppContext): void {
    this.rng = new Rng(this.seedProvider());
    this.mech.reset(this.rng, ctx);
    this.state = 'playing';
    this.elapsed = 0;
    this.distance = 0;
    this.pickups = 0;
    this.nearMisses = 0;
    this.combo = 0;
    this.newBest = false;
    this.trail.reset();
    this.runStartMs = performance.now();
    ctx.juice.tone(523, { durationMs: 90, type: 'triangle' });
  }

  handleInput(events: readonly InputEvent[], ctx: AppContext): void {
    for (const e of events) {
      if (this.state === 'dead') {
        // Instant restart on any press (design pillar: <800ms, single tap).
        if (e.type === 'press') this.startRun(ctx);
        continue;
      }
      if (e.type === 'press') {
        this.mech.onPress(ctx);
        ctx.juice.tone(300, { durationMs: 55, volume: 0.08, type: 'square' });
      } else {
        this.mech.onRelease(e.holdMs, ctx);
      }
    }
  }

  update(dt: number, ctx: AppContext): void {
    this.backdrop.update(dt);
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const ramp = computeRamp(this.elapsed, this.mech.cfg.ramp);
    const r = this.mech.update(dt, ramp, ctx);
    this.distance += r.advanced;
    this.pickups += r.pickups;
    this.nearMisses += r.nearMisses;

    const view = this.mech.cometView(ctx, 1);
    this.trail.push(view.x, view.y);

    if (r.pickups > 0) {
      ctx.juice.burst(view.x, view.y, { count: 14, color: PALETTE.fg, speed: 150 });
      ctx.juice.tone(880, { durationMs: 90 });
    }
    if (r.nearMisses > 0) {
      this.combo += r.nearMisses;
      ctx.juice.flash(PALETTE.accent, 0.16);
      ctx.juice.shake(0.16);
      ctx.juice.burst(view.x, view.y, { count: 8, color: PALETTE.accent, speed: 120 });
      // combo raises the pitch — reward escalation
      ctx.juice.tone(560 + this.combo * 45, { durationMs: 80, type: 'sine' });
    }
    if (r.dead) this.die(ctx, view);
  }

  private die(ctx: AppContext, view: { x: number; y: number }): void {
    this.state = 'dead';
    this.runEndMs = performance.now();
    const runMs = this.runEndMs - this.runStartMs;
    this.deaths++;
    this.totalPlayMs += runMs;
    const score = this.score();
    this.newBest = score > this.bestScore && score > 0;
    this.bestScore = Math.max(this.bestScore, score);
    this.combo = 0;

    // death juice
    ctx.juice.hitstop(75);
    ctx.juice.shake(0.9);
    ctx.juice.flash(PALETTE.accentAlt, 0.4);
    ctx.juice.burst(view.x, view.y, { count: 40, color: PALETTE.accentAlt, speed: 320, life: 0.8 });
    ctx.juice.burst(view.x, view.y, { count: 20, color: PALETTE.fg, speed: 180 });
    ctx.juice.tone(150, { durationMs: 260, type: 'sawtooth', volume: 0.16 });
    if (this.newBest) {
      ctx.juice.tone(660, { durationMs: 120 });
      ctx.juice.tone(880, { durationMs: 160 });
    }

    const deathsPerMin = this.totalPlayMs > 0 ? this.deaths / (this.totalPlayMs / 60000) : 0;
    recordRun({
      proto: this.mech.cfg.id,
      seed: this.rng.seed,
      runMs,
      score,
      distance: Math.floor(this.distance),
      nearMisses: this.nearMisses,
      deathsPerMin,
      ts: Date.now(),
    });
  }

  private score(): number {
    const c = this.mech.cfg;
    return (
      Math.floor(this.distance) + this.pickups * c.pickupValue + this.nearMisses * c.nearMissBonus
    );
  }

  render(alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    this.backdrop.render(c, w, h, this.distance);

    // world (obstacles + pickups) over the backdrop
    this.mech.render(alpha, ctx);

    // comet trail + glowing body on top
    const view = this.mech.cometView(ctx, alpha);
    this.trail.render(c, this.cometRadius());
    drawComet(c, view.x, view.y, this.cometRadius(), {
      stretch: view.stretch ?? 1,
      angle: view.angle ?? 0,
    });

    this.drawHud(ctx);
    if (this.state === 'dead') this.drawDeath(ctx);
  }

  private cometRadius(): number {
    return 14;
  }

  private drawHud(ctx: AppContext): void {
    const { ctx: c, width: w } = ctx;
    const runMs = (this.state === 'playing' ? performance.now() : this.runEndMs) - this.runStartMs;
    c.save();
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.fillStyle = PALETTE.fg;
    c.font = '700 22px system-ui, sans-serif';
    c.fillText(String(this.score()), 16, 14);
    c.fillStyle = PALETTE.dim;
    c.font = '400 12px ui-monospace, monospace';
    c.fillText(
      `${this.mech.cfg.name}  ·  near ${this.nearMisses}  ·  ${(runMs / 1000).toFixed(1)}s`,
      16,
      42,
    );
    c.textAlign = 'right';
    c.fillText(`best ${this.bestScore}`, w - 16, 42);

    // combo pip — escalates with consecutive near misses
    if (this.combo > 1) {
      c.textAlign = 'center';
      c.fillStyle = PALETTE.accent;
      c.font = '800 26px system-ui, sans-serif';
      c.fillText(`x${this.combo}`, w / 2, 18);
    }
    c.restore();
  }

  private drawDeath(ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.save();
    c.fillStyle = 'rgba(4, 6, 14, 0.6)';
    c.fillRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    if (this.newBest) {
      c.fillStyle = PALETTE.accent;
      c.font = '800 18px system-ui, sans-serif';
      c.fillText('★ NEW BEST ★', w / 2, h * 0.34);
    }

    c.save();
    c.shadowColor = PALETTE.accentAlt;
    c.shadowBlur = 24;
    c.fillStyle = PALETTE.accentAlt;
    c.font = '800 40px system-ui, sans-serif';
    c.fillText('CRASH', w / 2, h * 0.43);
    c.restore();

    c.fillStyle = PALETTE.fg;
    c.font = '700 22px system-ui, sans-serif';
    c.fillText(`${this.score()}`, w / 2, h * 0.52);
    c.fillStyle = PALETTE.dim;
    c.font = '400 14px system-ui, sans-serif';
    c.fillText(`near misses ${this.nearMisses}`, w / 2, h * 0.575);
    c.fillStyle = PALETTE.fg;
    c.font = '500 15px system-ui, sans-serif';
    c.fillText('tap to try again', w / 2, h * 0.65);
    c.restore();
  }
}
