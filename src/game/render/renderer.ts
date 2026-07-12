import { Backdrop } from '../../ui/backdrop';
import { CometTrail, drawComet } from '../../ui/comet';
import { PALETTE } from '../../ui/palette';
import { GAME, VW, VH, CEIL_LINE, FLOOR_LINE } from '../core/config';
import { clamp } from '../core/geom';
import type { FlipSim } from '../core/sim';
import type { Skin } from '../core/skins';
import { DEFAULT_SKIN } from '../core/skins';

export interface RenderOptions {
  skin?: Skin;
  ghost?: FlipSim | null;
}

/** Maps the virtual playfield onto the canvas and draws the FLIP world. */
export class GameRenderer {
  private readonly backdrop = new Backdrop();
  private trail = new CometTrail(22, DEFAULT_SKIN.trail);
  private ghostTrail = new CometTrail(16, 'rgba(255,255,255,0.6)');

  reset(skin: Skin = DEFAULT_SKIN): void {
    this.trail = new CometTrail(22, skin.trail);
    this.ghostTrail = new CometTrail(16, 'rgba(255,255,255,0.55)');
  }

  update(dt: number, sim: FlipSim, opts: RenderOptions = {}): void {
    this.backdrop.update(dt);
    if (sim.alive) this.trail.push(GAME.cometX, sim.y);
    const ghost = opts.ghost;
    if (ghost && ghost.alive) this.ghostTrail.push(GAME.cometX, ghost.y);
  }

  render(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    sim: FlipSim,
    alpha: number,
    opts: RenderOptions = {},
  ): void {
    const skin = opts.skin ?? DEFAULT_SKIN;
    const scale = Math.min(cw / VW, ch / VH);
    const pw = VW * scale;
    const ph = VH * scale;
    const ox = (cw - pw) / 2;
    const oy = (ch - ph) / 2;
    const cameraX = sim.renderCameraX(alpha);

    // backdrop fills the whole canvas (letterbox bars become extra starfield)
    this.backdrop.render(ctx, cw, ch, cameraX * scale);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();

    // playfield tint for contrast
    ctx.fillStyle = 'rgba(6,9,20,0.35)';
    ctx.fillRect(0, 0, VW, VH);

    // lane bands
    this.laneBands(ctx, skin);

    // obstacles + pickups
    for (const o of sim.obstacles) {
      const sx = o.x - cameraX;
      if (sx > VW + 40 || sx + GAME.wallW < -40) continue;
      if (o.kind === 'gate') {
        this.solid(ctx, sx, 0, GAME.wallW, o.gapTop);
        this.solid(ctx, sx, o.gapBottom, GAME.wallW, VH - o.gapBottom);
      } else {
        const ry = o.surface === 'floor' ? FLOOR_LINE - o.height : CEIL_LINE;
        this.solid(ctx, sx, ry, GAME.wallW, o.height);
      }
      if (o.pickup && !o.pickup.taken) {
        this.pickup(ctx, o.pickup.x - cameraX, o.pickup.y, sim.elapsed);
      }
    }

    // ghost comet (translucent)
    const ghost = opts.ghost;
    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      this.ghostTrail.render(ctx, GAME.cometR * 0.8);
      drawComet(ctx, GAME.cometX, ghost.renderY(alpha), GAME.cometR * 0.9, {
        color: '#dfe8ff',
        glow: '#8fb0ff',
      });
      ctx.restore();
    }

    // comet trail + body
    const cy = sim.renderY(alpha);
    this.trail.render(ctx, GAME.cometR);
    const stretch = clamp(1 + Math.abs(sim.vy) / 2600, 1, 1.55);
    drawComet(ctx, GAME.cometX, cy, GAME.cometR, {
      color: skin.body,
      glow: skin.glow,
      stretch,
      angle: Math.PI / 2,
    });

    // subtle inner frame
    ctx.strokeStyle = 'rgba(123,131,166,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, VW - 2, VH - 2);
    ctx.restore();
  }

  private laneBands(ctx: CanvasRenderingContext2D, skin: Skin): void {
    const top = ctx.createLinearGradient(0, 0, 0, CEIL_LINE);
    top.addColorStop(0, this.rgba(skin.glow, 0.18));
    top.addColorStop(1, this.rgba(skin.glow, 0));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, VW, CEIL_LINE);
    const bot = ctx.createLinearGradient(0, FLOOR_LINE, 0, VH);
    bot.addColorStop(0, this.rgba(skin.glow, 0));
    bot.addColorStop(1, this.rgba(skin.glow, 0.18));
    ctx.fillStyle = bot;
    ctx.fillRect(0, FLOOR_LINE, VW, VH - FLOOR_LINE);
    // surface lines
    ctx.strokeStyle = this.rgba(skin.glow, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CEIL_LINE);
    ctx.lineTo(VW, CEIL_LINE);
    ctx.moveTo(0, FLOOR_LINE);
    ctx.lineTo(VW, FLOOR_LINE);
    ctx.stroke();
  }

  private solid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (h <= 0) return;
    ctx.save();
    ctx.shadowColor = PALETTE.accentAlt;
    ctx.shadowBlur = 18;
    const r = Math.min(10, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff5f79');
    g.addColorStop(1, '#ff8fa2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  private pickup(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const pulse = 0.85 + 0.15 * Math.sin(t * 6 + x * 0.05);
    const rr = GAME.pickupR * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.2);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.4, 'rgba(255,212,90,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private rgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
