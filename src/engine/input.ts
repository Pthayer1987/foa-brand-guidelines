/**
 * Unified input layer.
 *
 * Collapses pointer (touch/mouse) and keyboard (Space) into a single
 * one-touch abstraction exposing press / hold / release with timestamps.
 * Design pillar: input → visible response under 50ms, so every event carries
 * the DOM `timeStamp` (same clock as performance.now()) and the layer can
 * report the event→render latency for the debug overlay.
 */

export type InputEventType = 'press' | 'release';

export interface InputEvent {
  type: InputEventType;
  /** performance.now()-relative timestamp of the originating DOM event. */
  time: number;
  /** For 'release': how long the input was held, in ms. 0 for 'press'. */
  holdMs: number;
}

export class Input {
  private _pressed = false;
  private pressTime = 0;
  private queue: InputEvent[] = [];
  /** Timestamp of the most recent unmeasured event, for latency sampling. */
  private pendingLatencyStamp = -1;

  /** Event→render latency in ms of the last processed input. */
  lastLatencyMs = 0;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Whether the input is currently held down. */
  get pressed(): boolean {
    return this._pressed;
  }

  /** Live hold duration in ms while pressed, else 0. */
  get holdMs(): number {
    return this._pressed ? performance.now() - this.pressTime : 0;
  }

  /** Drain queued press/release events for the current update tick. */
  drain(): readonly InputEvent[] {
    if (this.queue.length === 0) return EMPTY;
    const q = this.queue;
    this.queue = [];
    return q;
  }

  /** Call once per rendered frame to measure event→render latency. */
  sampleLatency(now = performance.now()): void {
    if (this.pendingLatencyStamp >= 0) {
      this.lastLatencyMs = now - this.pendingLatencyStamp;
      this.pendingLatencyStamp = -1;
    }
  }

  private press(time: number): void {
    if (this._pressed) return;
    this._pressed = true;
    this.pressTime = time;
    this.pendingLatencyStamp = time;
    this.queue.push({ type: 'press', time, holdMs: 0 });
  }

  private release(time: number): void {
    if (!this._pressed) return;
    const holdMs = time - this.pressTime;
    this._pressed = false;
    this.pendingLatencyStamp = time;
    this.queue.push({ type: 'release', time, holdMs });
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.press(e.timeStamp);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.release(e.timeStamp);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'Space') return;
    if (e.repeat) return; // ignore auto-repeat; a hold is one press
    e.preventDefault(); // stop page scroll
    this.press(e.timeStamp);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== 'Space') return;
    this.release(e.timeStamp);
  };

  private onBlur = (): void => {
    // Losing focus mid-hold would otherwise leave the input stuck down.
    this.release(performance.now());
  };
}

const EMPTY: readonly InputEvent[] = Object.freeze([]);
