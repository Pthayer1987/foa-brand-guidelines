import type { AppContext, Scene } from './types';

/**
 * Registers scenes by name and drives the active one. Scene switches are
 * deferred to the start of the next update so a scene never swaps out from
 * under itself mid-tick.
 */
export class SceneManager {
  private readonly scenes = new Map<string, Scene>();
  private current: Scene | undefined;
  private pending: string | undefined;

  register(scene: Scene): this {
    this.scenes.set(scene.name, scene);
    return this;
  }

  /** Queue a transition; applied before the next update. */
  switchTo(name: string): void {
    if (!this.scenes.has(name)) {
      throw new Error(`SceneManager: unknown scene "${name}"`);
    }
    this.pending = name;
  }

  get active(): Scene | undefined {
    return this.current;
  }

  get activeName(): string {
    return this.current?.name ?? '(none)';
  }

  private applyPending(ctx: AppContext): void {
    if (this.pending === undefined) return;
    const next = this.scenes.get(this.pending);
    if (!next) throw new Error(`SceneManager: unknown scene "${this.pending}"`);
    const prevName = this.current?.name;
    this.current?.exit?.(next.name, ctx);
    this.current = next;
    this.pending = undefined;
    next.enter?.(prevName, ctx);
  }

  update(dt: number, ctx: AppContext): void {
    this.applyPending(ctx);
    const scene = this.current;
    if (!scene) return;
    scene.handleInput?.(ctx.input.drain(), ctx);
    scene.update(dt, ctx);
  }

  render(alpha: number, ctx: AppContext): void {
    this.current?.render(alpha, ctx);
  }
}
