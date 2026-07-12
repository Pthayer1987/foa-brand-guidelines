import { GameLoop } from '../engine/loop';
import { Input } from '../engine/input';
import type { JuiceSystem } from '../juice/juice';
import { PALETTE } from '../ui/palette';
import { GAME, VW, VH, medalFor, type MedalId } from './core/config';
import { FlipSim } from './core/sim';
import { GameRenderer } from './render/renderer';
import { Bloom } from './render/bloom';
import { PostFX } from './render/postfx';
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
  private ctx!: CanvasRenderingContext2D; // draw target (offscreen when post is on)
  private readonly input: Input;
  private readonly renderer = new GameRenderer();
  private readonly bloom = new Bloom();
  private loop: GameLoop | null = null;

  // WebGL post-processing; falls back to plain 2D when unavailable
  private post: PostFX | null = null;
  private usePost = false;
  private sceneCanvas: HTMLCanvasElement | null = null;

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
    this.input = new Input(canvas);

    // Try the WebGL post pipeline on the visible canvas; render the 2D scene
    // to an offscreen buffer that becomes the shader input.
    const post = new PostFX();
    if (post.init(canvas)) {
      this.post = post;
      this.usePost = true;
      this.sceneCanvas = document.createElement('canvas');
      const sc = this.sceneCanvas.getContext('2d', { alpha: false });
      if (!sc) throw new Error('PlayController: no 2D context');
      this.ctx = sc;
    } else {
      const c = canvas.getContext('2d', { alpha: false });
      if (!c) throw new Error('PlayController: no 2D context');
      this.ctx = c;
    }
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
      this.juice.sfxFlip(this.sim.gravitySign === -1);
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
      this.juice.sfxPickup();
    }
    if (ev.nearMiss > 0) {
      this.juice.flash(this.cfg.skin.glow, 0.14);
      this.juice.shake(0.14);
      this.juice.burst(cx, cy, { count: 8, color: this.cfg.skin.trail, speed: 130 });
      this.juice.sfxNear(this.sim.combo);
    }
    if (ev.died) {
      this.juice.hitstop(80);
      this.juice.shake(1);
      this.juice.flash(PALETTE.accentAlt, 0.42);
      this.juice.burst(cx, cy, { count: 44, color: PALETTE.accentAlt, speed: 340, life: 0.85 });
      this.juice.burst(cx, cy, { count: 22, color: this.cfg.skin.body, speed: 190 });
      this.juice.sfxDeath();
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
    // draw the 2D scene (to the offscreen buffer when post is on)
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

    if (this.usePost && this.post && this.sceneCanvas) {
      // GPU post: bright-pass → gaussian bloom → composite (CA + vignette + grain)
      this.post.render(
        this.sceneCanvas,
        performance.now() / 1000,
        this.juice.reducedMotion ? 0 : 1,
      );
    } else if (!this.juice.reducedMotion) {
      // 2D fallback bloom
      this.bloom.apply(this.ctx, this.canvas, 0.55, 5);
    }

    this.cb.onFrame(this.sim);
  }

  private cssW = 0;
  private cssH = 0;
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width || window.innerWidth;
    this.cssH = rect.height || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const dw = Math.round(this.cssW * this.dpr);
    const dh = Math.round(this.cssH * this.dpr);
    this.canvas.width = dw;
    this.canvas.height = dh;
    if (this.usePost && this.sceneCanvas && this.post) {
      this.sceneCanvas.width = dw;
      this.sceneCanvas.height = dh;
      this.post.resize(dw, dh);
    }
  }
}

// re-exports used by the shell
export { VW, VH, skinById };
