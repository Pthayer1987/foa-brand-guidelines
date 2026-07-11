import type { AppContext } from '../../engine/types';
import type { Rng } from '../../engine/rng';

/** Difficulty ramp constants — the single tunable knob-set per prototype. */
export interface RampConfig {
  /** World scroll speed (px/sec) at run start. */
  baseSpeed: number;
  /** World scroll speed (px/sec) at full ramp. */
  maxSpeed: number;
  /** Seconds of play to reach maxSpeed. */
  rampSeconds: number;
  /** Obstacle gap size (px) at run start. */
  baseGap: number;
  /** Tightest gap (px) at full ramp. */
  minGap: number;
}

export interface ProtoConfig {
  /** Route id: 'a' | 'b' | 'c'. */
  id: string;
  /** Display name: CHARGE / ORBIT / FLIP. */
  name: string;
  ramp: RampConfig;
  /** Score per pickup. */
  pickupValue: number;
  /** Score per near miss (near-miss reward psychology). */
  nearMissBonus: number;
  /** Passing within this many px of a lethal edge counts as a near miss. */
  nearMissThresholdPx: number;
}

/** Ramp values sampled for the current instant. */
export interface RampState {
  speed: number;
  gap: number;
}

/** What a mechanic reports back from one fixed-step update. */
export interface StepResult {
  /** World distance advanced this step (drives distance score). */
  advanced: number;
  /** Pickups collected this step. */
  pickups: number;
  /** Near misses registered this step. */
  nearMisses: number;
  /** Whether the player died this step. */
  dead: boolean;
}

export const NO_STEP: StepResult = { advanced: 0, pickups: 0, nearMisses: 0, dead: false };

/**
 * A prototype mechanic. The shared harness owns the run lifecycle, scoring,
 * telemetry, restart, difficulty ramp and HUD; each mechanic owns only its
 * world, physics, collision and graybox rendering.
 */
export interface Mechanic {
  readonly cfg: ProtoConfig;
  /** Rebuild the world for a fresh run from a seeded RNG. */
  reset(rng: Rng, ctx: AppContext): void;
  /** Input pressed (finger down / space down). */
  onPress(ctx: AppContext): void;
  /** Input released, with how long it was held (ms). */
  onRelease(holdMs: number, ctx: AppContext): void;
  /** Fixed-step logic update. */
  update(dt: number, ramp: RampState, ctx: AppContext): StepResult;
  /** Draw the graybox world (HUD is drawn by the harness on top). */
  render(alpha: number, ctx: AppContext): void;
}
