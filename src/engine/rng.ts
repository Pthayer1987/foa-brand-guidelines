/**
 * Seeded RNG. The daily-run pillar requires that the same seed produces the
 * identical sequence for every player on Earth, so this must be fully
 * deterministic and free of any platform-specific float behaviour.
 *
 * - `hashSeed` (xmur3) turns a string ("2026-07-10") into a 32-bit uint.
 * - `mulberry32` is a fast, well-distributed 32-bit generator.
 */

/** xmur3 string hash → unsigned 32-bit integer. */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ergonomic wrapper over mulberry32 with common helpers. */
export class Rng {
  readonly seed: number;
  private readonly next01: () => number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this.next01 = mulberry32(this.seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.next01();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next01() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(min + this.next01() * (max - min + 1));
  }

  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next01() * arr.length)] as T;
  }

  /** True with probability p (default 0.5). */
  bool(p = 0.5): boolean {
    return this.next01() < p;
  }
}
