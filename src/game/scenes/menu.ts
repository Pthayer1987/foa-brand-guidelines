import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { PALETTE } from '../../ui/palette';
import { Backdrop } from '../../ui/backdrop';
import { drawComet } from '../../ui/comet';

/** Title screen. Any press starts the hello-world game scene. */
export class MenuScene implements Scene {
  readonly name = 'menu';
  private t = 0;
  private readonly backdrop = new Backdrop();

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
    this.backdrop.update(dt);
  }

  render(_alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    this.backdrop.render(c, w, h, this.t * 40);

    // a comet arcs slowly across behind the title
    const cx = w * (0.15 + 0.7 * ((this.t * 0.06) % 1));
    const cy = h * (0.24 + 0.03 * Math.sin(this.t * 0.9));
    drawComet(c, cx, cy, 10, { angle: 0.3, stretch: 1.3 });

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = PALETTE.accent;
    c.shadowBlur = 26;
    c.fillStyle = PALETTE.fg;
    c.font = `800 ${Math.min(w * 0.19, 104)}px system-ui, sans-serif`;
    c.fillText('COMET', w / 2, h * 0.42);
    c.restore();

    // gentle pulse on the prompt
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 3);
    c.save();
    c.globalAlpha = pulse;
    c.fillStyle = PALETTE.accent;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `600 ${Math.min(w * 0.045, 22)}px system-ui, sans-serif`;
    c.fillText('tap or press space', w / 2, h * 0.6);
    c.restore();

    c.fillStyle = PALETTE.dim;
    c.textAlign = 'center';
    c.font = `400 13px system-ui, sans-serif`;
    c.fillText('` debug · M mute', w / 2, h - 28);
  }
}
