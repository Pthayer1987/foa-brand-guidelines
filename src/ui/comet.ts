import { PALETTE } from './palette';

export interface CometStyle {
  color?: string;
  glow?: string;
  /** Squash/stretch: 1 = round; >1 stretches along `angle`. */
  stretch?: number;
  angle?: number;
}

function rgbaOf(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Draws a glowing comet: wide corona, anamorphic lens streaks, bright core. */
export function drawComet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  style: CometStyle = {},
): void {
  const color = style.color ?? PALETTE.accent;
  const glow = style.glow ?? color;
  const stretch = style.stretch ?? 1;
  const angle = style.angle ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';

  // wide soft corona (screen-aligned, not stretched)
  const corona = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 4);
  corona.addColorStop(0, rgbaOf(glow, 0.55));
  corona.addColorStop(0.3, rgbaOf(glow, 0.22));
  corona.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(0, 0, r * 4, 0, Math.PI * 2);
  ctx.fill();

  // anamorphic lens streaks (horizontal + vertical)
  ctx.save();
  const hstreak = ctx.createLinearGradient(-r * 7, 0, r * 7, 0);
  hstreak.addColorStop(0, 'rgba(0,0,0,0)');
  hstreak.addColorStop(0.5, rgbaOf(glow, 0.5));
  hstreak.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hstreak;
  ctx.fillRect(-r * 7, -r * 0.09, r * 14, r * 0.18);
  const vstreak = ctx.createLinearGradient(0, -r * 5, 0, r * 5);
  vstreak.addColorStop(0, 'rgba(0,0,0,0)');
  vstreak.addColorStop(0.5, rgbaOf(glow, 0.4));
  vstreak.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vstreak;
  ctx.fillRect(-r * 0.07, -r * 5, r * 0.14, r * 10);
  ctx.restore();

  // body (stretched along travel)
  ctx.rotate(angle);
  ctx.scale(stretch, 1 / stretch);
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.05, 0, 0, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, color);
  body.addColorStop(1, '#137e6c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // hot specular core
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, -r * 0.2, -r * 0.2, r * 0.7);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.15, r * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** A short fading motion trail behind the comet. */
export class CometTrail {
  private pts: { x: number; y: number }[] = [];
  constructor(
    private readonly max = 16,
    private readonly color: string = PALETTE.accent,
  ) {}

  reset(): void {
    this.pts.length = 0;
  }

  push(x: number, y: number): void {
    this.pts.push({ x, y });
    if (this.pts.length > this.max) this.pts.shift();
  }

  render(ctx: CanvasRenderingContext2D, r: number): void {
    if (this.pts.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // soft glowing dots, tapering from tail to head
    for (let i = 0; i < this.pts.length; i++) {
      const p = this.pts[i] as { x: number; y: number };
      const f = i / this.pts.length; // 0 oldest → 1 newest
      const rad = r * (0.25 + f * 1.1);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = f * f * 0.6;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // bright core streak — segmented so it fades toward the tail
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1] as { x: number; y: number };
      const b = this.pts[i] as { x: number; y: number };
      const f = i / this.pts.length;
      ctx.globalAlpha = f * f * 0.55;
      ctx.lineWidth = Math.max(0.6, r * 0.14 * f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
