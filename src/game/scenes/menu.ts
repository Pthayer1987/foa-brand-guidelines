import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { PALETTE } from '../../ui/palette';

/** Title screen. Any press starts the hello-world game scene. */
export class MenuScene implements Scene {
  readonly name = 'menu';
  private t = 0;

  enter(): void {
    this.t = 0;
  }

  handleInput(events: readonly InputEvent[], ctx: AppContext): void {
    if (events.some((e) => e.type === 'press')) {
      ctx.juice.tone(440);
      ctx.scenes.switchTo('game');
    }
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(_alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.fillStyle = PALETTE.bg;
    c.fillRect(0, 0, w, h);

    c.textAlign = 'center';
    c.fillStyle = PALETTE.fg;
    c.font = `700 ${Math.min(w * 0.18, 96)}px system-ui, sans-serif`;
    c.textBaseline = 'middle';
    c.fillText('COMET', w / 2, h * 0.4);

    // gentle pulse on the prompt
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 3);
    c.fillStyle = PALETTE.accent;
    c.globalAlpha = pulse;
    c.font = `500 ${Math.min(w * 0.045, 22)}px system-ui, sans-serif`;
    c.fillText('tap or press space', w / 2, h * 0.58);
    c.globalAlpha = 1;

    c.fillStyle = PALETTE.dim;
    c.font = `400 13px system-ui, sans-serif`;
    c.fillText('Phase 0 · engine core · ` toggles debug', w / 2, h - 28);
  }
}
