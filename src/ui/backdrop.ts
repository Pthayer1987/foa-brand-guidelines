import { Rng } from '../engine/rng';
import { PALETTE } from './palette';

interface Star {
  x: number; // 0..1
  y: number; // 0..1
  depth: number; // 0.2 (far) .. 1 (near)
  size: number;
  twinkle: number;
}

/**
 * Animated starfield + gradient backdrop, shared by every scene. Deep-space
 * gradient, parallax stars that drift with world scroll, a slow nebula glow,
 * and a vignette. Cheap: a few hundred dots, no per-star allocation per frame.
 */
export class Backdrop {
  private readonly stars: Star[];
  private t = 0;

  constructor(count = 140, seed = 'comet-stars') {
    const rng = new Rng(seed);
    this.stars = Array.from({ length: count }, () => ({
      x: rng.next(),
      y: rng.next(),
      depth: 0.2 + rng.next() * 0.8,
      size: 0.4 + rng.next() * 1.7,
      twinkle: rng.next() * Math.PI * 2,
    }));
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, scrollX = 0): void {
    // deep-space vertical gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0d1c');
    g.addColorStop(0.55, PALETTE.bg);
    g.addColorStop(1, '#070912');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // two drifting nebula clouds for depth
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const nx = w * (0.5 + 0.28 * Math.sin(this.t * 0.09));
    const ny = h * (0.38 + 0.14 * Math.cos(this.t * 0.07));
    const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(w, h) * 0.6);
    neb.addColorStop(0, 'rgba(77,225,193,0.12)');
    neb.addColorStop(0.5, 'rgba(90,120,255,0.05)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
    const mx = w * (0.5 - 0.32 * Math.cos(this.t * 0.05));
    const my = h * (0.66 + 0.12 * Math.sin(this.t * 0.06));
    const neb2 = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(w, h) * 0.5);
    neb2.addColorStop(0, 'rgba(168,90,255,0.10)');
    neb2.addColorStop(0.5, 'rgba(255,122,144,0.04)');
    neb2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // parallax stars
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const drift = (scrollX * s.depth * 0.15 + this.t * s.depth * 6) % w;
      let sx = s.x * w - drift;
      sx = ((sx % w) + w) % w;
      const sy = s.y * h;
      const tw = 0.55 + 0.45 * Math.sin(this.t * (0.6 + s.depth) + s.twinkle);
      ctx.globalAlpha = tw * (0.35 + s.depth * 0.6);
      ctx.fillStyle = s.depth > 0.8 ? PALETTE.accent : PALETTE.fg;
      ctx.beginPath();
      ctx.arc(sx, sy, s.size * s.depth, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // occasional shooting star
    this.shootingStar(ctx, w, h);

    // vignette
    const vig = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** A streak that crosses the sky every few seconds. */
  private shootingStar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const PERIOD = 5.5;
    const DUR = 0.9;
    const idx = Math.floor(this.t / PERIOD);
    const local = this.t - idx * PERIOD;
    if (local > DUR) return;
    // pseudo-random per streak from the index
    const rnd = (n: number): number => {
      const s = Math.sin(idx * 12.9898 + n * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const p = local / DUR;
    const sx = rnd(1) * w;
    const sy = rnd(2) * h * 0.5;
    const ang = 0.5 + rnd(3) * 0.6;
    const dist = Math.max(w, h) * 0.9;
    const hx = sx + Math.cos(ang) * dist * p;
    const hy = sy + Math.sin(ang) * dist * p;
    const tailLen = 120;
    const tx = hx - Math.cos(ang) * tailLen;
    const ty = hy - Math.sin(ang) * tailLen;
    const fade = Math.sin(p * Math.PI); // fade in/out
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(200,240,255,${0.8 * fade})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${fade})`;
    ctx.beginPath();
    ctx.arc(hx, hy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
