/** Aggregate stats an achievement can test against. */
export interface Aggregate {
  bestScore: number;
  bestMedalRank: number; // 0 none .. 4 comet
  lifetimeNearMisses: number;
  lifetimePickups: number;
  totalRuns: number;
  deaths: number;
  streakLongest: number;
}

export interface Achievement {
  skin: string; // skin id it unlocks
  desc: string;
  test: (a: Aggregate) => boolean;
}

/** Each non-default skin is earned by play. `aurora` is unlocked from the start. */
export const ACHIEVEMENTS: Achievement[] = [
  { skin: 'ember', desc: 'Earn a Bronze medal', test: (a) => a.bestMedalRank >= 1 },
  { skin: 'ice', desc: 'Earn a Silver medal', test: (a) => a.bestMedalRank >= 2 },
  { skin: 'gold', desc: 'Earn a Gold medal', test: (a) => a.bestMedalRank >= 3 },
  { skin: 'sun', desc: 'Earn the COMET medal', test: (a) => a.bestMedalRank >= 4 },
  { skin: 'rose', desc: '50 lifetime near misses', test: (a) => a.lifetimeNearMisses >= 50 },
  { skin: 'magenta', desc: '250 lifetime near misses', test: (a) => a.lifetimeNearMisses >= 250 },
  { skin: 'lime', desc: 'Collect 100 pickups', test: (a) => a.lifetimePickups >= 100 },
  { skin: 'mint', desc: 'Play 100 runs', test: (a) => a.totalRuns >= 100 },
  { skin: 'crimson', desc: 'Crash 100 times', test: (a) => a.deaths >= 100 },
  { skin: 'violet', desc: 'Reach a 3-day streak', test: (a) => a.streakLongest >= 3 },
  { skin: 'azure', desc: 'Reach a 7-day streak', test: (a) => a.streakLongest >= 7 },
  { skin: 'plasma', desc: 'Reach a 14-day streak', test: (a) => a.streakLongest >= 14 },
  // `ghost` (Wisp) is the weekly variable-reward random drop, handled in the store.
];
