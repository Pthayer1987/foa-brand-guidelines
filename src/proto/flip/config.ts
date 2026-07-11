import type { ProtoConfig } from '../shared/mechanic';

/** Tunable constants for FLIP. Frozen here so tuning lives in one place. */
export const FLIP_CONFIG: ProtoConfig = {
  id: 'c',
  name: 'FLIP',
  ramp: {
    baseSpeed: 230,
    maxSpeed: 520,
    rampSeconds: 55,
    baseGap: 220,
    minGap: 130,
  },
  pickupValue: 25,
  nearMissBonus: 6,
  nearMissThresholdPx: 18,
};

export const FLIP = {
  laneMargin: 64, // floor/ceiling band thickness (px)
  cometR: 14,
  cometX: 0.28, // comet screen x as fraction of width
  gravity: 3600, // px/sec^2 toward the active surface
  obstacleW: 30,
  obstacleMinH: 55,
  obstacleMaxH: 150,
  spawnMinGap: 210, // horizontal spacing (world px)
  spawnMaxGap: 360,
  pickupChance: 0.45,
  pickupR: 10,
} as const;
