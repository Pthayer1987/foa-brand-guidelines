import { Backdrop } from '../../ui/backdrop';
import { CometTrail, drawComet } from '../../ui/comet';
import { GAME, VW, VH, CEIL_LINE, FLOOR_LINE } from '../core/config';
import { clamp } from '../core/geom';
import { Rng } from '../../engine/rng';
import type { FlipSim } from '../core/sim';
import type { Skin } from '../core/skins';
import { DEFAULT_SKIN } from '../core/skins';

export interface RenderOptions {
  skin?: Skin;
  ghost?: FlipSim | null;
}

interface Dust {
  x: number;
  y: number;
  r: number;
  depth: number;
}

/** Maps the virtual playfield onto the canvas and draws the FLIP world. */
export class GameRenderer {
  private readonly backdrop = new Backdrop();
  private trail = new CometTrail(22, DEFAULT_SKIN.trail);
  private ghostTrail = new CometTrail(16, 'rgba(255,255,255,0.6)');
  private readonly dust: Dust[];

  constructor() {
    const rng = new Rng('comet-dust');
    this.dust = Array.from({ length: 40 }, () => ({
      x: rng.next() * VW * 3,
      y: rng.range(CEIL_LINE, FLOOR_LINE),
      r: rng.range(1.5, 4.5),
      depth: rng.range(1.4, 2.4), // >1 → foreground parallax
    }));
  }

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
        this.solid(ctx, sx, 0, GAME.wallW, o.gapTop, sim.elapsed);
        this.solid(ctx, sx, o.gapBottom, GAME.wallW, VH - o.gapBottom, sim.elapsed);
      } else {
        const ry = o.surface === 'floor' ? FLOOR_LINE - o.height : CEIL_LINE;
        this.solid(ctx, sx, ry, GAME.wallW, o.height, sim.elapsed);
      }
      if (o.pickup && !o.pickup.taken) {
        this.pickup(ctx, o.pickup.x - cameraX, o.pickup.y, sim.elapsed);
      }
    }

    // foreground parallax dust
    this.drawDust(ctx, cameraX);

    // comet reflection on the nearest surface
    const cyNow = sim.renderY(alpha);
    this.reflection(ctx, cyNow, skin);

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

    // combo vignette — the field glows hotter as your combo climbs
    if (sim.combo > 0) {
      const inten = Math.min(1, sim.combo / 6);
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.28, VW / 2, VH / 2, VH * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, this.rgba(skin.glow, 0.08 + 0.2 * inten));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VW, VH);
    }

    // subtle inner frame
    ctx.strokeStyle = 'rgba(123,131,166,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, VW - 2, VH - 2);
    ctx.restore();
  }

  private drawDust(ctx: CanvasRenderingContext2D, cameraX: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const span = VW + 80;
    for (const d of this.dust) {
      let sx = (d.x - cameraX * d.depth) % span;
      sx = ((sx % span) + span) % span;
      sx -= 40;
      const a = 0.06 + (d.depth - 1.4) * 0.05;
      const g = ctx.createRadialGradient(sx, d.y, 0, sx, d.y, d.r * 3);
      g.addColorStop(0, `rgba(200,230,255,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, d.y, d.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private reflection(ctx: CanvasRenderingContext2D, cy: number, skin: Skin): void {
    const draw = (ry: number, a: number): void => {
      if (a <= 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(GAME.cometX, ry, 0, GAME.cometX, ry, GAME.cometR * 2.4);
      g.addColorStop(0, this.rgba(skin.glow, a));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(GAME.cometX, ry, GAME.cometR * 1.6, GAME.cometR * 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    // floor reflection (fades as the comet lifts away)
    draw(2 * FLOOR_LINE - cy, 0.3 * clamp(1 - (FLOOR_LINE - cy) / 320, 0, 1));
    // ceiling reflection
    draw(2 * CEIL_LINE - cy, 0.3 * clamp(1 - (cy - CEIL_LINE) / 320, 0, 1));
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

  private solid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    t: number,
  ): void {
    if (h <= 0) return;
    const r = Math.min(12, w / 2, h / 2);

    // body with neon glow
    ctx.save();
    ctx.shadowColor = '#ff4f6a';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#c4304a');
    g.addColorStop(0.5, '#ff7488');
    g.addColorStop(1, '#c4304a');
    ctx.fillStyle = g;
    ctx.fill();

    // inner detailing, clipped to the bar
    ctx.shadowBlur = 0;
    ctx.clip();
    const v = ctx.createLinearGradient(0, y, 0, y + h);
    v.addColorStop(0, 'rgba(255,255,255,0.18)');
    v.addColorStop(0.12, 'rgba(255,255,255,0)');
    v.addColorStop(0.9, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = v;
    ctx.fillRect(x, y, w, h);

    // scrolling energy band
    const bandH = 46;
    const off = (t * 120 + x * 1.7) % (h + bandH);
    const by = y - bandH + off;
    const band = ctx.createLinearGradient(0, by, 0, by + bandH);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,224,232,0.3)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = band;
    ctx.fillRect(x, by, w, bandH);
    ctx.restore();

    // bright edge
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
    ctx.strokeStyle = 'rgba(255,185,200,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private pickup(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const pulse = 0.85 + 0.15 * Math.sin(t * 6 + x * 0.05);
    const rr = GAME.pickupR * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // halo
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.6);
    g.addColorStop(0, '#fff7d2');
    g.addColorStop(0.35, 'rgba(255,212,90,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr * 2.6, 0, Math.PI * 2);
    ctx.fill();
    // rotating sparkle
    ctx.translate(x, y);
    ctx.rotate(t * 1.6);
    ctx.fillStyle = '#fff';
    this.spark(ctx, rr * 2, rr * 0.5);
    ctx.rotate(Math.PI / 4);
    this.spark(ctx, rr * 1.2, rr * 0.32);
    ctx.restore();
    // core
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private spark(ctx: CanvasRenderingContext2D, long: number, short: number): void {
    ctx.beginPath();
    ctx.moveTo(0, -long);
    ctx.lineTo(short, 0);
    ctx.lineTo(0, long);
    ctx.lineTo(-short, 0);
    ctx.closePath();
    ctx.moveTo(-long, 0);
    ctx.lineTo(0, short);
    ctx.lineTo(long, 0);
    ctx.lineTo(0, -short);
    ctx.closePath();
    ctx.fill();
  }

  private rgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
