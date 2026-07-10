/**
 * Juice module — Phase 0 stub.
 *
 * Every prototype and scene calls these hooks so that the real
 * implementation (Phase 4) can be dropped in without touching game logic.
 * For now they are intentional no-ops. Build the juice layer alongside game
 * logic, never bolted on after.
 */

export interface BurstOptions {
  count?: number;
  color?: string;
  speed?: number;
}

export interface ToneOptions {
  durationMs?: number;
  type?: 'sine' | 'square' | 'triangle' | 'sawtooth';
  volume?: number;
}

export interface Juice {
  /** Particle burst at a point (e.g. death explosion, pickup). */
  burst(x: number, y: number, opts?: BurstOptions): void;
  /** Screen shake. magnitude in CSS pixels. */
  shake(magnitude: number, durationMs?: number): void;
  /** Freeze-frame on impact (60–80ms) for weight. */
  hitstop(durationMs: number): void;
  /** Synthesised tone (rising pitch tied to streaks, etc). */
  tone(freq: number, opts?: ToneOptions): void;
}

/** Creates the Phase 0 no-op juice. Replaced by a real synth/particle system later. */
export function createJuice(): Juice {
  return {
    burst(_x, _y, _opts) {
      /* no-op stub */
    },
    shake(_magnitude, _durationMs) {
      /* no-op stub */
    },
    hitstop(_durationMs) {
      /* no-op stub */
    },
    tone(_freq, _opts) {
      /* no-op stub */
    },
  };
}
