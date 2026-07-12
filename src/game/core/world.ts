import type { Rng } from '../../engine/rng';
import { GAME, CEIL_LINE, FLOOR_LINE, CROSS_TIME } from './config';

export type Surface = 'floor' | 'ceil';

export interface Pickup {
  x: number;
  y: number;
  taken: boolean;
}

interface Base {
  x: number; // world x, left edge
  passed: boolean;
  minClear: number; // closest clearance seen while alongside the comet
  pickup: Pickup | null;
}

export interface Gate extends Base {
  kind: 'gate';
  gapTop: number;
  gapBottom: number;
}

export interface Spike extends Base {
  kind: 'spike';
  surface: Surface;
  height: number;
}

export type Obstacle = Gate | Spike;

/** Spacing to the next feature. Never less than the distance the world travels
 *  while the comet crosses the lane (× safety) — guarantees every gate is
 *  physically reachable, so no death is unfair. */
export function spacingFor(rng: Rng, speed: number): number {
  const jitter = rng.range(0, GAME.spacingJitter);
  const solvable = speed * CROSS_TIME * GAME.solvableSafety;
  return Math.max(GAME.baseSpacing + jitter, solvable);
}

/** Deterministic next obstacle given the RNG stream, previous x, current gap and speed. */
export function nextObstacle(rng: Rng, prevX: number, gap: number, speed: number): Obstacle {
  const x = prevX + spacingFor(rng, speed);

  if (rng.bool(GAME.spikeChance)) {
    const surface: Surface = rng.bool() ? 'floor' : 'ceil';
    const height = rng.range(GAME.spikeMin, GAME.spikeMax);
    const spike: Spike = {
      kind: 'spike',
      surface,
      height,
      x,
      passed: false,
      minClear: Infinity,
      pickup: null,
    };
    if (rng.bool(GAME.pickupChance)) {
      // reward skimming just off the spike tip, on the lane side
      const tip = surface === 'floor' ? FLOOR_LINE - height : CEIL_LINE + height;
      const y = surface === 'floor' ? tip - GAME.pickupR - 8 : tip + GAME.pickupR + 8;
      spike.pickup = { x: x + GAME.wallW / 2, y, taken: false };
    }
    return spike;
  }

  const onFloor = rng.bool();
  const gapTop = onFloor ? FLOOR_LINE - gap : CEIL_LINE;
  const gapBottom = onFloor ? FLOOR_LINE : CEIL_LINE + gap;
  const gate: Gate = {
    kind: 'gate',
    gapTop,
    gapBottom,
    x,
    passed: false,
    minClear: Infinity,
    pickup: null,
  };
  if (rng.bool(GAME.pickupChance)) {
    // place near the dangerous inner edge of the opening
    const y = onFloor ? gapTop + GAME.pickupR + 10 : gapBottom - GAME.pickupR - 10;
    gate.pickup = { x: x + GAME.wallW / 2, y, taken: false };
  }
  return gate;
}
