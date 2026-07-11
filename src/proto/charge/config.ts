import type { ProtoConfig } from '../shared/mechanic';

/** Tunable constants for CHARGE. */
export const CHARGE_CONFIG: ProtoConfig = {
  id: 'a',
  name: 'CHARGE',
  ramp: {
    baseSpeed: 190,
    maxSpeed: 430,
    rampSeconds: 60,
    baseGap: 210,
    minGap: 128,
  },
  pickupValue: 30,
  nearMissBonus: 6,
  nearMissThresholdPx: 18,
};

export const CHARGE = {
  cometR: 14,
  cometX: 0.3,
  gravity: 1500, // px/sec^2 falling
  chargeGravity: 140, // near-float while charging (buys aiming time)
  chargeTimeMax: 0.6, // seconds of hold for a full-power launch
  impulseMax: 620, // launch velocity (px/sec) at full charge
  impulseMin: 150, // launch velocity at a bare tap
  wallW: 34,
  spawnMinGap: 250, // horizontal spacing (world px)
  spawnMaxGap: 340,
  edgeMargin: 46, // keep gaps off the extreme top/bottom
  pickupChance: 0.5,
  pickupR: 10,
} as const;
