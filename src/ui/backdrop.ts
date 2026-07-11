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

    // drifting nebula glow
    const nx = w * (0.5 + 0.28 * Math.sin(this.t * 0.09));
    const ny = h * (0.38 + 0.14 * Math.cos(this.t * 0.07));
    const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(w, h) * 0.6);
    neb.addColorStop(0, 'rgba(77,225,193,0.10)');
    neb.addColorStop(0.5, 'rgba(90,120,255,0.05)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

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
}
