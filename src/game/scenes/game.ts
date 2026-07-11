import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { Rng } from '../../engine/rng';
import { PALETTE } from '../../ui/palette';
import { Backdrop } from '../../ui/backdrop';
import { CometTrail, drawComet } from '../../ui/comet';
import { dailyRng } from '../dailySeed';
import { runState } from '../runState';

/**
 * Phase 0 hello-world scene. No real gameplay — it exists to exercise the
 * engine: every press snaps the marker to a new seeded position (an instant,
 * visible response for the <50ms latency test), and a long hold + release
 * ends the run into the results scene.
 */
export class GameScene implements Scene {
  readonly name = 'game';

  private rng: Rng = dailyRng();
  private taps = 0;
  private markerX = 0.5;
  private markerY = 0.5;
  // interpolation: previous + current normalised positions
  private prevX = 0.5;
  private prevY = 0.5;
  private ripple = 0;
  private readonly backdrop = new Backdrop();
  private readonly trail = new CometTrail(14);

  enter(): void {
    // Seeded so the sequence of jumps is identical across reloads (same day).
    this.rng = dailyRng();
    this.taps = 0;
    this.markerX = this.prevX = 0.5;
    this.markerY = this.prevY = 0.5;
    this.ripple = 0;
    this.trail.reset();
  }

  handleInput(events: readonly InputEvent[], ctx: AppContext): void {
    for (const e of events) {
      if (e.type === 'press') {
        this.taps++;
        this.prevX = this.markerX;
        this.prevY = this.markerY;
        this.markerX = this.rng.range(0.15, 0.85);
        this.markerY = this.rng.range(0.2, 0.8);
        this.ripple = 1;
        ctx.juice.tone(520 + this.taps * 12);
        ctx.juice.burst(this.markerX * ctx.width, this.markerY * ctx.height);
      } else if (e.type === 'release' && e.holdMs > 500) {
        // A deliberate long-hold ends the run.
        runState.lastScore = this.taps;
        ctx.juice.hitstop(70);
        ctx.scenes.switchTo('results');
      }
    }
  }

  update(dt: number): void {
    this.backdrop.update(dt);
    if (this.ripple > 0) this.ripple = Math.max(0, this.ripple - dt * 3);
  }

  render(alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h, input } = ctx;
    this.backdrop.render(c, w, h);

    const x = (this.prevX + (this.markerX - this.prevX) * alpha) * w;
    const y = (this.prevY + (this.markerY - this.prevY) * alpha) * h;
    this.trail.push(x, y);

    // ripple ring on tap
    if (this.ripple > 0) {
      c.save();
      c.strokeStyle = PALETTE.accentAlt;
      c.globalAlpha = this.ripple;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y, 24 + (1 - this.ripple) * 60, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // marker (glowing comet)
    this.trail.render(c, 18);
    drawComet(c, x, y, 18);

    // live hold bar (shows press/hold reading straight from the input layer)
    if (input.pressed) {
      const frac = Math.min(1, input.holdMs / 500);
      c.fillStyle = PALETTE.dim;
      c.fillRect(w * 0.25, h - 40, w * 0.5, 6);
      c.fillStyle = frac >= 1 ? PALETTE.accentAlt : PALETTE.fg;
      c.fillRect(w * 0.25, h - 40, w * 0.5 * frac, 6);
    }

    c.textAlign = 'center';
    c.fillStyle = PALETTE.fg;
    c.font = '600 20px system-ui, sans-serif';
    c.textBaseline = 'top';
    c.fillText(`taps ${this.taps}`, w / 2, 24);
    c.fillStyle = PALETTE.dim;
    c.font = '400 13px system-ui, sans-serif';
    c.fillText('tap to move · hold & release to finish', w / 2, 52);
  }
}
