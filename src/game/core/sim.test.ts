import { describe, it, expect } from 'vitest';
import { FlipSim } from './sim';
import { medalFor } from './config';

function snapshot(s: FlipSim) {
  return {
    y: s.y,
    vy: s.vy,
    sign: s.gravitySign,
    score: s.score,
    near: s.nearMisses,
    alive: s.alive,
  };
}

describe('FlipSim determinism', () => {
  it('same seed + no input → identical run (the daily-run guarantee)', () => {
    const a = new FlipSim('2026-07-12');
    const b = new FlipSim('2026-07-12');
    for (let i = 0; i < 900; i++) {
      a.tick();
      b.tick();
      expect(snapshot(a)).toEqual(snapshot(b));
    }
  });

  it('different seeds diverge', () => {
    const a = new FlipSim('seed-a');
    const b = new FlipSim('seed-b');
    for (let i = 0; i < 300; i++) {
      a.tick();
      b.tick();
    }
    expect(a.score === b.score && a.distance === b.distance).toBe(false);
  });
});

describe('FlipSim ghost replay', () => {
  it('replaying the recorded flip log reproduces the run exactly', () => {
    const flipTicks = [20, 55, 90, 130, 175, 210, 260, 300, 355];
    const live = new FlipSim('ghost-seed', { record: true });
    const liveSnaps: ReturnType<typeof snapshot>[] = [];
    for (let i = 0; i < 500; i++) {
      if (flipTicks.includes(i)) live.flip();
      live.tick();
      liveSnaps.push(snapshot(live));
    }

    const ghost = new FlipSim('ghost-seed', { replay: live.getFlipLog() });
    for (let i = 0; i < 500; i++) {
      ghost.tick();
      expect(snapshot(ghost)).toEqual(liveSnaps[i]);
    }
    expect(ghost.score).toBe(live.score);
  });
});

describe('medals', () => {
  it('bucket scores into medal tiers', () => {
    expect(medalFor(0).id).toBe('none');
    expect(medalFor(700).id).toBe('bronze');
    expect(medalFor(2000).id).toBe('silver');
    expect(medalFor(4000).id).toBe('gold');
    expect(medalFor(9000).id).toBe('comet');
  });
});

describe('FlipSim scoring', () => {
  it('score never decreases across a run', () => {
    const s = new FlipSim('mono');
    let prev = 0;
    for (let i = 0; i < 600 && s.alive; i++) {
      s.tick();
      expect(s.score).toBeGreaterThanOrEqual(prev);
      prev = s.score;
    }
  });
});
