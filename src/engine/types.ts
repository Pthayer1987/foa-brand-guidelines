import type { Input, InputEvent } from './input';
import type { Juice } from '../juice/juice';
import type { SceneManager } from './scene';

/**
 * Shared context handed to every scene each tick. Holds the render surface,
 * input, juice, and the scene manager (for transitions). Logical sizes are in
 * CSS pixels — the canvas backing store is scaled by devicePixelRatio.
 */
export interface AppContext {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Logical width in CSS pixels. */
  width: number;
  /** Logical height in CSS pixels. */
  height: number;
  readonly input: Input;
  readonly juice: Juice;
  readonly scenes: SceneManager;
}

/**
 * A scene (menu, game, results, prototype…). Update runs at the fixed 60Hz
 * step; render interpolates with `alpha`. `handleInput` receives drained
 * press/release events before update, so a scene can react to a tap on the
 * exact tick it happened.
 */
export interface Scene {
  readonly name: string;
  enter?(prev: string | undefined, ctx: AppContext): void;
  exit?(next: string | undefined, ctx: AppContext): void;
  handleInput?(events: readonly InputEvent[], ctx: AppContext): void;
  update(dt: number, ctx: AppContext): void;
  render(alpha: number, ctx: AppContext): void;
}
