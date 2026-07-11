import type { RampConfig, RampState } from './mechanic';
import { clamp, lerp } from './math';

/**
 * Shared difficulty ramp: speed rises and gap tightens as the run progresses.
 * Deterministic in elapsed time, so the same seed + same inputs reproduce the
 * same difficulty at every moment.
 */
export function computeRamp(elapsedSec: number, cfg: RampConfig): RampState {
  const t = clamp(elapsedSec / cfg.rampSeconds, 0, 1);
  // Ease-in so early seconds stay gentle (first-death 5–15s target, Phase 2).
  const eased = t * t;
  return {
    speed: lerp(cfg.baseSpeed, cfg.maxSpeed, eased),
    gap: lerp(cfg.baseGap, cfg.minGap, eased),
  };
}
