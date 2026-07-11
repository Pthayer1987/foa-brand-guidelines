import type { ProtoConfig } from '../shared/mechanic';

/** Tunable constants for ORBIT. Here `gap` drives the anchor capture radius. */
export const ORBIT_CONFIG: ProtoConfig = {
  id: 'b',
  name: 'ORBIT',
  ramp: {
    baseSpeed: 150,
    maxSpeed: 320,
    rampSeconds: 60,
    baseGap: 66, // generous capture radius early
    minGap: 40, // tight capture radius late
  },
  pickupValue: 30,
  nearMissBonus: 8,
  nearMissThresholdPx: 12,
};

export const ORBIT = {
  cometR: 11,
  anchorR: 8,
  radiusMin: 50,
  radiusMax: 84,
  omega: 3.0, // rad/sec angular speed while orbiting
  launchBoost: 70, // forward (+x) velocity added on release
  spawnMinGap: 175, // horizontal anchor spacing (world px)
  spawnMaxGap: 245,
  yMargin: 84, // vertical play bounds inset
  startLead: 0.32, // first anchor screen-x fraction
} as const;
