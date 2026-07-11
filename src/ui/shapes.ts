/** Glowing rounded rectangle — the graybox obstacle look. */
export function glowRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 7,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Glowing, softly pulsing pickup orb. */
export function glowPickup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  pulse: number,
): void {
  const rr = r * (0.85 + 0.15 * Math.sin(pulse));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.4);
  g.addColorStop(0, color);
  g.addColorStop(0.4, 'rgba(242,245,255,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, rr * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
