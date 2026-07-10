/**
 * Fixed-timestep game loop.
 *
 * Logic updates at a fixed 60Hz (deterministic — critical for seeded daily
 * runs and input-log replay), decoupled from the rAF render which interpolates
 * between the two most recent logic states via `alpha`.
 *
 * Reference: "Fix Your Timestep!" (Gaffer on Games).
 */

/** Fixed logic timestep in seconds (60Hz). */
export const STEP = 1 / 60;

/** Clamp for a single frame delta — protects against the spiral of death
 *  after a tab is backgrounded and refocused. */
const MAX_FRAME = 0.25;

/** Hard cap on catch-up steps per frame. */
const MAX_STEPS = 5;

export interface LoopCallbacks {
  /** Advance logic by exactly `dt` seconds (always === STEP). */
  update(dt: number): void;
  /** Render, interpolating with `alpha` in [0, 1) between logic states. */
  render(alpha: number): void;
}

export interface LoopStats {
  /** Smoothed frames per second. */
  fps: number;
  /** Wall-clock ms between the last two rAF callbacks. */
  frameMs: number;
  /** ms spent in update() this frame. */
  updateMs: number;
  /** ms spent in render() this frame. */
  renderMs: number;
  /** Count of spiral-of-death recoveries since start. */
  panics: number;
}

export class GameLoop {
  readonly stats: LoopStats = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    renderMs: 0,
    panics: 0,
  };

  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  // fps smoothing over a ~0.5s window
  private fpsFrames = 0;
  private fpsTimer = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    this.stats.frameMs = frameTime * 1000;

    if (frameTime > MAX_FRAME) {
      frameTime = MAX_FRAME;
      this.stats.panics++;
    }
    this.accumulator += frameTime;

    const uStart = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP) {
      this.cb.update(STEP);
      this.accumulator -= STEP;
      if (++steps >= MAX_STEPS) {
        // Fell too far behind; drop the backlog rather than spiral.
        this.accumulator = 0;
        this.stats.panics++;
        break;
      }
    }
    this.stats.updateMs = performance.now() - uStart;

    const alpha = this.accumulator / STEP;
    const rStart = performance.now();
    this.cb.render(alpha);
    this.stats.renderMs = performance.now() - rStart;

    this.fpsFrames++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsTimer;
      this.fpsTimer = 0;
      this.fpsFrames = 0;
    }

    this.rafId = requestAnimationFrame(this.frame);
  };
}
