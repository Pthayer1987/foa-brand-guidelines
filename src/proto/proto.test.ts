import { describe, it, expect } from 'vitest';
import { Rng } from '../engine/rng';
import { nextWall } from './charge/charge';
import { nextAnchor } from './orbit/orbit';
import { nextObstacle } from './flip/flip';

const H = 800;

function chargeField(seed: string, n = 40) {
  const rng = new Rng(seed);
  let x = 0;
  return Array.from({ length: n }, () => {
    x += 300;
    return nextWall(rng, x, 180, H);
  });
}

function orbitField(seed: string, n = 40) {
  const rng = new Rng(seed);
  let x = 0;
  return Array.from({ length: n }, () => {
    x += 200;
    return nextAnchor(rng, x, H);
  });
}

function flipField(seed: string, n = 40) {
  const rng = new Rng(seed);
  let x = 0;
  return Array.from({ length: n }, () => {
    x += 280;
    return nextObstacle(rng, x);
  });
}

describe('prototype obstacle determinism (same seed => identical layout)', () => {
  it('CHARGE walls replay identically', () => {
    expect(chargeField('2026-07-11')).toEqual(chargeField('2026-07-11'));
  });
  it('ORBIT anchors replay identically', () => {
    expect(orbitField('2026-07-11')).toEqual(orbitField('2026-07-11'));
  });
  it('FLIP obstacles replay identically', () => {
    expect(flipField('2026-07-11')).toEqual(flipField('2026-07-11'));
  });

  it('different seeds produce different layouts', () => {
    expect(chargeField('seed-a')).not.toEqual(chargeField('seed-b'));
    expect(orbitField('seed-a')).not.toEqual(orbitField('seed-b'));
    expect(flipField('seed-a')).not.toEqual(flipField('seed-b'));
  });
});

describe('generators stay within bounds', () => {
  it('CHARGE gapY keeps the gap on-screen', () => {
    for (const w of chargeField('bounds')) {
      expect(w.gapY).toBeGreaterThanOrEqual(0);
      expect(w.gapY + w.gap).toBeLessThanOrEqual(H);
    }
  });
  it('ORBIT anchors stay inside vertical margins', () => {
    for (const a of orbitField('bounds')) {
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(H);
      expect(Math.abs(a.dir)).toBe(1);
    }
  });
  it('FLIP obstacle heights are positive', () => {
    for (const o of flipField('bounds')) {
      expect(o.h).toBeGreaterThan(0);
      expect(['floor', 'ceil']).toContain(o.surface);
    }
  });
});
