import { GameLoop } from '../engine/loop';
import { Input } from '../engine/input';
import type { JuiceSystem } from '../juice/juice';
import { PALETTE } from '../ui/palette';
import { GAME, VW, VH, medalFor, type MedalId } from './core/config';
import { FlipSim } from './core/sim';
import { GameRenderer } from './render/renderer';
import { skinById, type Skin } from './core/skins';

export interface RunConfig {
  mode: 'practice' | 'daily';
  seed: string;
  date?: string;
  skin: Skin;
  ghostLog?: readonly number[];
}

export interface RunEnd {
  mode: 'practice' | 'daily';
  date?: string;
  score: number;
  nearMisses: number;
  pickups: number;
  medal: MedalId;
  timeMs: number;
  flipLog: readonly number[];
}

export interface PlayCallbacks {
  onFrame(sim: FlipSim): void;
  onEnd(result: RunEnd): void;
}

/** Drives a single run: engine loop + input + juice + sim + renderer. */
export class PlayController {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly renderer = new GameRenderer();
  private loop: GameLoop | null = null;

  private sim!: FlipSim;
  private ghost: FlipSim | null = null;
  private cfg!: RunConfig;
  private cb!: PlayCallbacks;
  private dpr = 1;
  private ended = false;
  private endTimer = 0;
  private startMs = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly juice: JuiceSystem,
  ) {
    const c = canvas.getContext('2d', { alpha: false });
    if (!c) throw new Error('PlayController: no 2D context');
    this.ctx = c;
    this.input = new Input(canvas);
  }

  start(cfg: RunConfig, cb: PlayCallbacks): void {
    this.cfg = cfg;
    this.cb = cb;
    this.sim = new FlipSim(cfg.seed, { record: true });
    this.ghost =
      cfg.ghostLog && cfg.ghostLog.length ? new FlipSim(cfg.seed, { replay: cfg.ghostLog }) : null;
    this.renderer.reset(cfg.skin);
    this.ended = false;
    this.endTimer = 0;
    this.startMs = performance.now();
    this.input.drain(); // clear any queued taps
    this.resize();

    this.loop?.stop();
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
    this.loop.start();
  }

  stop(): void {
    this.loop?.stop();
    this.loop = null;
  }

  /** Pause without penalty (tab hidden). Sim state is preserved. */
  pause(): void {
    this.loop?.stop();
  }

  /** Resume a paused run. */
  resume(): void {
    if (this.loop && !this.ended) this.loop.start();
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
  }

  private update(dt: number): void {
    this.juice.update(dt);

    // input → flips
    for (const e of this.input.drain()) {
      if (e.type !== 'press') continue;
      if (this.ended) continue;
      this.sim.flip();
      this.juice.tone(300, { durationMs: 45, volume: 0.07, type: 'square' });
    }

    if (this.juice.frozen) return;

    if (!this.ended) {
      const ev = this.sim.tick();
      this.ghost?.tick();
      this.renderer.update(dt, this.sim, { ghost: this.ghost });
      this.reactTo(ev);
      if (ev.died) this.beginEnd();
    } else {
      // brief death beat before results
      this.endTimer -= dt;
      this.renderer.update(dt, this.sim, { ghost: this.ghost });
      if (this.endTimer <= 0) this.finish();
    }
  }

  private reactTo(ev: { died: boolean; nearMiss: number; pickup: number }): void {
    const cx = GAME.cometX;
    const cy = this.sim.y;
    if (ev.pickup > 0) {
      this.juice.burst(cx, cy, { count: 16, color: '#ffe07a', speed: 170 });
      this.juice.tone(900 + this.sim.multiplier * 40, { durationMs: 90 });
    }
    if (ev.nearMiss > 0) {
      this.juice.flash(this.cfg.skin.glow, 0.14);
      this.juice.shake(0.14);
      this.juice.burst(cx, cy, { count: 8, color: this.cfg.skin.trail, speed: 130 });
      this.juice.tone(540 + this.sim.combo * 48, { durationMs: 75, type: 'sine' });
    }
    if (ev.died) {
      this.juice.hitstop(80);
      this.juice.shake(1);
      this.juice.flash(PALETTE.accentAlt, 0.42);
      this.juice.burst(cx, cy, { count: 44, color: PALETTE.accentAlt, speed: 340, life: 0.85 });
      this.juice.burst(cx, cy, { count: 22, color: this.cfg.skin.body, speed: 190 });
      this.juice.tone(150, { durationMs: 260, type: 'sawtooth', volume: 0.16 });
    }
  }

  private beginEnd(): void {
    this.ended = true;
    this.endTimer = 0.5; // ~500ms beat, still under the 800ms restart pillar
  }

  private finish(): void {
    this.stop();
    const s = this.sim;
    const result: RunEnd = {
      mode: this.cfg.mode,
      ...(this.cfg.date ? { date: this.cfg.date } : {}),
      score: s.score,
      nearMisses: s.nearMisses,
      pickups: s.pickupsCollected,
      medal: medalFor(s.score).id,
      timeMs: performance.now() - this.startMs,
      flipLog: s.getFlipLog(),
    };
    this.cb.onEnd(result);
  }

  private render(alpha: number): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.cssW, this.cssH);

    const shake = this.juice.shakeOffset();
    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);
    this.renderer.render(this.ctx, this.cssW, this.cssH, this.sim, alpha, {
      skin: this.cfg.skin,
      ghost: this.ghost,
    });
    this.juice.renderParticles(this.ctx);
    this.ctx.restore();
    this.juice.renderOverlays(this.ctx, this.cssW, this.cssH);

    this.cb.onFrame(this.sim);
  }

  private cssW = 0;
  private cssH = 0;
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width || window.innerWidth;
    this.cssH = rect.height || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
  }
}

// re-exports used by the shell
export { VW, VH, skinById };
