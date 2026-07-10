import { describe, it, expect } from 'vitest';
import { Rng, hashSeed, mulberry32 } from './rng';

describe('hashSeed', () => {
  it('is deterministic for a given string', () => {
    expect(hashSeed('2026-07-10')).toBe(hashSeed('2026-07-10'));
  });

  it('produces different hashes for different strings', () => {
    expect(hashSeed('2026-07-10')).not.toBe(hashSeed('2026-07-11'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed('comet');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('mulberry32', () => {
  it('produces the identical sequence for the same seed (replay/reload safe)', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('yields floats in [0, 1)', () => {
    const next = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('diverges for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('Rng', () => {
  it('replays the same sequence from the same string seed across instances', () => {
    const seq1 = collect(new Rng('daily-2026-07-10'));
    const seq2 = collect(new Rng('daily-2026-07-10'));
    expect(seq1).toEqual(seq2);
  });

  it('same seed => identical obstacle-style layout (the daily-run guarantee)', () => {
    const layout = (seed: string) =>
      Array.from({ length: 50 }, () => {
        const r = new Rng(seed);
        return { gap: r.range(80, 200), lane: r.int(0, 3), risky: r.bool(0.3) };
      });
    expect(layout('2026-07-10')).toEqual(layout('2026-07-10'));
  });

  it('exposes the resolved numeric seed', () => {
    const r = new Rng('abc');
    expect(r.seed).toBe(hashSeed('abc'));
  });

  it('int() stays within inclusive bounds', () => {
    const r = new Rng('bounds');
    for (let i = 0; i < 500; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('pick() returns a member of the array', () => {
    const r = new Rng('pick');
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });
});

function collect(r: Rng, n = 100): number[] {
  return Array.from({ length: n }, () => r.next());
}
