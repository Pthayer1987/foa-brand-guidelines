import { Rng } from '../engine/rng';

/** UTC date string (YYYY-MM-DD) — the basis of the worldwide-shared daily seed. */
export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Deterministic RNG for today's daily run (Phase 5 uses this in earnest). */
export function dailyRng(date: Date = new Date()): Rng {
  return new Rng(`comet-daily-${utcDateString(date)}`);
}

/** Fresh random-seeded RNG for practice runs. */
export function practiceRng(): Rng {
  // A varied string seed; determinism isn't required for practice.
  const seed = `comet-practice-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e9)}`;
  return new Rng(seed);
}
