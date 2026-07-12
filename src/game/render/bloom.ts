/**
 * Cheap full-screen bloom. Downscales the rendered frame, blurs it, and
 * composites it back additively so bright neon elements bleed light. The blur
 * runs on a small offscreen buffer (≈1/3 res) so it stays well within budget.
 */
export class Bloom {
  private buf: HTMLCanvasElement | null = null;
  private bctx: CanvasRenderingContext2D | null = null;
  private supported: boolean;

  constructor() {
    // ctx.filter (blur) is required; degrade gracefully if absent.
    this.supported = typeof document !== 'undefined';
  }

  apply(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, strength = 0.6, blur = 4): void {
    if (!this.supported) return;
    const dw = Math.max(1, Math.round(src.width / 3));
    const dh = Math.max(1, Math.round(src.height / 3));
    if (!this.buf) {
      this.buf = document.createElement('canvas');
      this.bctx = this.buf.getContext('2d');
    }
    const b = this.buf;
    const bc = this.bctx;
    if (!bc) return;
    if (b.width !== dw || b.height !== dh) {
      b.width = dw;
      b.height = dh;
    }

    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, dw, dh);
    bc.filter = `blur(${blur}px)`;
    bc.globalCompositeOperation = 'source-over';
    bc.drawImage(src, 0, 0, dw, dh);
    bc.filter = 'none';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, 0, 0, src.width, src.height);
    ctx.restore();
  }
}
