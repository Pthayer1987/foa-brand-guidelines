/**
 * Frozen tuning constants for COMET's core mechanic (FLIP).
 *
 * All gameplay happens in a fixed VIRTUAL playfield (VW×VH) that the renderer
 * letterboxes onto the real canvas. This guarantees every device gets the
 * byte-identical daily run and keeps ghost replays in sync across screens.
 */

export const VW = 600;
export const VH = 1000;

export const GAME = {
  // playfield
  laneMargin: 70,
  cometR: 22,
  cometX: 180,

  // physics (virtual units / second)
  gravity: 5200,

  // difficulty ramp
  baseSpeed: 300,
  maxSpeed: 640,
  rampSeconds: 75,
  baseGap: 340, // gap opening at run start
  minGap: 210, // tightest gap at full ramp

  // obstacles
  wallW: 46,
  spikeChance: 0.32, // vs. a full gate
  spikeMin: 120,
  spikeMax: 300,
  baseSpacing: 360, // virtual px between features at run start
  spacingJitter: 120,
  solvableSafety: 1.35, // spacing >= crossing distance * this (fairness)
  pickupChance: 0.42,
  pickupR: 18,

  // scoring
  distanceDivisor: 12, // score gained per this many virtual px travelled
  pickupValue: 60,
  nearMissBase: 12, // base points per near miss (× combo multiplier)
  nearMissThreshold: 26, // px clearance that counts as a near miss
  comboWindow: 2.6, // seconds without a near miss before combo decays a tier
  maxMultiplier: 8,

  // feel
  firstDeathHintDeaths: 3, // show a hint only for the first N deaths
} as const;

/** Medal thresholds (score). Tuned to the run-length targets in Phase 2/3. */
export const MEDALS = [
  { id: 'comet', label: 'COMET', emoji: '☄️', min: 6000 },
  { id: 'gold', label: 'Gold', emoji: '🥇', min: 3200 },
  { id: 'silver', label: 'Silver', emoji: '🥈', min: 1500 },
  { id: 'bronze', label: 'Bronze', emoji: '🥉', min: 600 },
  { id: 'none', label: '—', emoji: '▫️', min: 0 },
] as const;

export type MedalId = (typeof MEDALS)[number]['id'];

export function medalFor(score: number): (typeof MEDALS)[number] {
  for (const m of MEDALS) if (score >= m.min) return m;
  return MEDALS[MEDALS.length - 1] as (typeof MEDALS)[number];
}

// Derived helpers -----------------------------------------------------------

export const CEIL_LINE = GAME.laneMargin;
export const FLOOR_LINE = VH - GAME.laneMargin;
export const CEIL_Y = CEIL_LINE + GAME.cometR; // comet centre resting on ceiling
export const FLOOR_Y = FLOOR_LINE - GAME.cometR; // comet centre resting on floor

/** Time (s) for the comet to fall from one surface to the other. */
export const CROSS_TIME = Math.sqrt((2 * (FLOOR_Y - CEIL_Y)) / GAME.gravity);
