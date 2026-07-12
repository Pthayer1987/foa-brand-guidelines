import { PALETTE } from './palette';

export interface CometStyle {
  color?: string;
  glow?: string;
  /** Squash/stretch: 1 = round; >1 stretches along `angle`. */
  stretch?: number;
  angle?: number;
}

/** Draws a glowing comet body with a bright core and soft halo. */
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
  ctx.rotate(angle);
  ctx.scale(stretch, 1 / stretch);

  // soft halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
  halo.addColorStop(0, glow);
  halo.addColorStop(0.4, 'rgba(77,225,193,0.35)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.5, color);
  body.addColorStop(1, '#1b9d86');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
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
