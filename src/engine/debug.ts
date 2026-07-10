import type { GameLoop } from './loop';
import type { Input } from './input';
import type { SceneManager } from './scene';

/**
 * Debug overlay: FPS, frame/update/render time, and input latency (ms).
 * Toggle with the `` ` `` (backtick) key. Off by default in production.
 */
export class DebugOverlay {
  visible = false;

  constructor(
    private readonly loop: GameLoop,
    private readonly input: Input,
    private readonly scenes: SceneManager,
    private readonly extra: () => Record<string, string | number> = () => ({}),
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        this.visible = !this.visible;
      }
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;

    const s = this.loop.stats;
    const lines: string[] = [
      `fps        ${s.fps.toFixed(1)}`,
      `frame      ${s.frameMs.toFixed(2)} ms`,
      `update     ${s.updateMs.toFixed(2)} ms`,
      `render     ${s.renderMs.toFixed(2)} ms`,
      `latency    ${this.input.lastLatencyMs.toFixed(1)} ms`,
      `panics     ${s.panics}`,
      `scene      ${this.scenes.activeName}`,
    ];
    for (const [k, v] of Object.entries(this.extra())) {
      lines.push(`${k.padEnd(10)} ${v}`);
    }

    ctx.save();
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    const pad = 8;
    const lineH = 16;
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
    const w = maxW + pad * 2;
    const h = lines.length * lineH + pad * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(8, 8, w, h);

    // latency > 50ms breaks a design pillar — flag it red.
    const latencyOk = this.input.lastLatencyMs <= 50;
    lines.forEach((line, i) => {
      ctx.fillStyle = line.startsWith('latency') && !latencyOk ? '#ff5a5a' : '#8affc1';
      ctx.fillText(line, 8 + pad, 8 + pad + i * lineH);
    });
    ctx.restore();
  }
}
