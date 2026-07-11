import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
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
    this.runStartMs = performance.now();
  }

  handleInput(events: readonly InputEvent[], ctx: AppContext): void {
    for (const e of events) {
      if (this.state === 'dead') {
        // Instant restart on any press (design pillar: <800ms, single tap).
        if (e.type === 'press') this.startRun(ctx);
        continue;
      }
      if (e.type === 'press') this.mech.onPress(ctx);
      else this.mech.onRelease(e.holdMs, ctx);
    }
  }

  update(dt: number, ctx: AppContext): void {
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const ramp = computeRamp(this.elapsed, this.mech.cfg.ramp);
    const r = this.mech.update(dt, ramp, ctx);
    this.distance += r.advanced;
    this.pickups += r.pickups;
    this.nearMisses += r.nearMisses;
    if (r.dead) this.die();
  }

  private die(): void {
    this.state = 'dead';
    this.runEndMs = performance.now();
    const runMs = this.runEndMs - this.runStartMs;
    this.deaths++;
    this.totalPlayMs += runMs;
    const score = this.score();
    this.bestScore = Math.max(this.bestScore, score);
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
    this.mech.render(alpha, ctx);
    this.drawHud(ctx);
    if (this.state === 'dead') this.drawDeath(ctx);
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
    c.restore();
  }

  private drawDeath(ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.save();
    c.fillStyle = 'rgba(4, 6, 14, 0.62)';
    c.fillRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = PALETTE.accentAlt;
    c.font = '700 34px system-ui, sans-serif';
    c.fillText('CRASH', w / 2, h * 0.42);
    c.fillStyle = PALETTE.fg;
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(`score ${this.score()}  ·  near ${this.nearMisses}`, w / 2, h * 0.52);
    c.fillStyle = PALETTE.dim;
    c.font = '400 15px system-ui, sans-serif';
    c.fillText('tap to try again', w / 2, h * 0.6);
    c.restore();
  }
}
