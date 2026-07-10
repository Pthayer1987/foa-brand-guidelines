import type { Scene, AppContext } from '../../engine/types';
import type { InputEvent } from '../../engine/input';
import { PALETTE } from '../../ui/palette';
import { runState } from '../runState';

/** Results screen. Any press returns to the menu (instant restart flow stub). */
export class ResultsScene implements Scene {
  readonly name = 'results';

  handleInput(events: readonly InputEvent[], ctx: AppContext): void {
    if (events.some((e) => e.type === 'press')) {
      ctx.juice.tone(660);
      ctx.scenes.switchTo('menu');
    }
  }

  update(): void {
    /* static screen */
  }

  render(_alpha: number, ctx: AppContext): void {
    const { ctx: c, width: w, height: h } = ctx;
    c.fillStyle = PALETTE.bg;
    c.fillRect(0, 0, w, h);

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = PALETTE.dim;
    c.font = '500 18px system-ui, sans-serif';
    c.fillText('RUN COMPLETE', w / 2, h * 0.34);

    c.fillStyle = PALETTE.accent;
    c.font = `700 ${Math.min(w * 0.16, 84)}px system-ui, sans-serif`;
    c.fillText(String(runState.lastScore), w / 2, h * 0.47);

    c.fillStyle = PALETTE.fg;
    c.font = '400 15px system-ui, sans-serif';
    c.fillText('taps this run', w / 2, h * 0.57);

    c.fillStyle = PALETTE.dim;
    c.font = '400 14px system-ui, sans-serif';
    c.fillText('press to return to menu', w / 2, h * 0.68);
  }
}
