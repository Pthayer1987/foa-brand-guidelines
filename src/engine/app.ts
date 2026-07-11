import { GameLoop } from './loop';
import { Input } from './input';
import { SceneManager } from './scene';
import { DebugOverlay } from './debug';
import { JuiceSystem } from '../juice/juice';
import type { AppContext, Scene } from './types';

export interface AppOptions {
  /** Canvas element to render into. */
  canvas: HTMLCanvasElement;
  /** Scenes to register up front. */
  scenes: Scene[];
  /** Name of the scene to start on. */
  start: string;
  /** Extra key/value rows for the debug overlay. */
  debugInfo?: () => Record<string, string | number>;
}

/**
 * Wires the engine together: canvas + DPR handling, input, juice, scene
 * manager, fixed-timestep loop, and the debug overlay. Owns the AppContext
 * passed to every scene.
 */
export class App {
  readonly ctx2d: CanvasRenderingContext2D;
  readonly input: Input;
  readonly scenes = new SceneManager();
  readonly loop: GameLoop;
  readonly debug: DebugOverlay;
  readonly juice: JuiceSystem;

  private dpr = 1;
  private readonly context: AppContext;

  constructor(private readonly opts: AppOptions) {
    const ctx = opts.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('App: 2D canvas context unavailable');
    this.ctx2d = ctx;

    this.input = new Input(opts.canvas);
    this.juice = new JuiceSystem();
    for (const scene of opts.scenes) this.scenes.register(scene);

    this.context = {
      canvas: opts.canvas,
      ctx,
      width: 0,
      height: 0,
      input: this.input,
      juice: this.juice,
      scenes: this.scenes,
    };

    this.loop = new GameLoop({
      update: (dt) => {
        this.juice.update(dt);
        // Hitstop: freeze scene logic for a beat while juice keeps animating.
        if (!this.juice.frozen) this.scenes.update(dt, this.context);
      },
      render: (alpha) => this.render(alpha),
    });

    this.debug = new DebugOverlay(this.loop, this.input, this.scenes, opts.debugInfo);

    window.addEventListener('resize', this.resize);
    // Mute toggle (persisted).
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.juice.toggleMute();
    });
    this.resize();
    this.scenes.switchTo(opts.start);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  private resize = (): void => {
    const canvas = this.opts.canvas;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || window.innerWidth;
    const cssH = rect.height || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3); // cap DPR for perf
    canvas.width = Math.round(cssW * this.dpr);
    canvas.height = Math.round(cssH * this.dpr);
    this.context.width = cssW;
    this.context.height = cssH;
  };

  private render(alpha: number): void {
    const { ctx2d: ctx, context: c } = this;
    // Re-establish the DPR transform each frame; scenes must save/restore
    // any further transforms they apply.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    // Screen shake offsets the whole scene + particles, but not the flash.
    const shake = this.juice.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.scenes.render(alpha, c);
    this.juice.renderParticles(ctx);
    ctx.restore();

    this.juice.renderOverlays(ctx, c.width, c.height);

    // Latency is the event→render gap; sample after the scene has drawn.
    this.input.sampleLatency();
    this.debug.render(ctx);
  }
}
