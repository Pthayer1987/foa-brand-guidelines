import { readJSON, writeJSON, readObfuscated, writeObfuscated } from './storage';
import { ACHIEVEMENTS, type Aggregate } from './achievements';
import { DEFAULT_SKIN } from '../core/skins';
import { MEDALS, type MedalId } from '../core/config';
import { utcDateString } from '../dailySeed';

const K_PROFILE = 'comet:profile';
const K_DAILY = 'comet:daily';
const K_STREAK = 'comet:streak';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface RunSummary {
  mode: 'practice' | 'daily';
  score: number;
  near: number;
  medal: MedalId;
  ts: number;
}

interface Profile {
  version: 1;
  sessions: number;
  totalRuns: number;
  deaths: number;
  bestScore: number;
  bestMedalRank: number;
  lifetimeNearMisses: number;
  lifetimePickups: number;
  recentRuns: RunSummary[];
  equippedSkin: string;
  unlockedSkins: string[];
  firstPlayTs: number;
  lastWeeklyDropTs: number;
}

interface DailyEntry {
  attempts: number;
  best: number;
  near: number;
  medal: MedalId;
  ghost: number[]; // flip log of the best attempt
  bestTs: number;
}
type DailyMap = Record<string, DailyEntry>;

interface Streak {
  current: number;
  longest: number;
  lastPlayed: string; // date string
  freezes: number;
}

export interface RunResult {
  mode: 'practice' | 'daily';
  date?: string;
  score: number;
  nearMisses: number;
  pickups: number;
  medal: MedalId;
  ghostLog?: readonly number[];
}

export interface RecordOutcome {
  newlyUnlocked: string[]; // skin ids
  weeklyDrop: string | null; // skin id of the surprise drop, if any
  isDailyBest: boolean;
}

function medalRank(id: MedalId): number {
  // MEDALS is ordered best→worst; rank 4=comet .. 0=none
  const idx = MEDALS.findIndex((m) => m.id === id);
  return MEDALS.length - 1 - idx;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

const DEFAULT_PROFILE = (now: number): Profile => ({
  version: 1,
  sessions: 0,
  totalRuns: 0,
  deaths: 0,
  bestScore: 0,
  bestMedalRank: 0,
  lifetimeNearMisses: 0,
  lifetimePickups: 0,
  recentRuns: [],
  equippedSkin: DEFAULT_SKIN.id,
  unlockedSkins: [DEFAULT_SKIN.id],
  firstPlayTs: now,
  lastWeeklyDropTs: now,
});

/** Single source of truth for all local persistence. */
export class GameStore {
  private profile: Profile;
  private daily: DailyMap;
  private streak: Streak;

  constructor(now = Date.now()) {
    this.profile = readJSON<Profile>(K_PROFILE, DEFAULT_PROFILE(now));
    if (!this.profile.unlockedSkins?.length) this.profile.unlockedSkins = [DEFAULT_SKIN.id];
    this.daily = readObfuscated<DailyMap>(K_DAILY, {});
    this.streak = readJSON<Streak>(K_STREAK, {
      current: 0,
      longest: 0,
      lastPlayed: '',
      freezes: 0,
    });
    this.profile.sessions += 1;
    this.saveProfile();
  }

  // ---- reads --------------------------------------------------------------

  get sessions(): number {
    return this.profile.sessions;
  }
  get equippedSkin(): string {
    return this.profile.equippedSkin;
  }
  get unlockedSkins(): readonly string[] {
    return this.profile.unlockedSkins;
  }
  get bestScore(): number {
    return this.profile.bestScore;
  }
  get totalRuns(): number {
    return this.profile.totalRuns;
  }
  get deaths(): number {
    return this.profile.deaths;
  }
  get lifetimeNearMisses(): number {
    return this.profile.lifetimeNearMisses;
  }
  get lifetimePickups(): number {
    return this.profile.lifetimePickups;
  }
  get recentRuns(): readonly RunSummary[] {
    return this.profile.recentRuns;
  }
  get streakInfo(): Readonly<Streak> {
    return this.streak;
  }

  dailyFor(date: string): DailyEntry | undefined {
    return this.daily[date];
  }

  attemptsLeft(date: string, max = 3): number {
    return Math.max(0, max - (this.daily[date]?.attempts ?? 0));
  }

  aggregate(): Aggregate {
    return {
      bestScore: this.profile.bestScore,
      bestMedalRank: this.profile.bestMedalRank,
      lifetimeNearMisses: this.profile.lifetimeNearMisses,
      lifetimePickups: this.profile.lifetimePickups,
      totalRuns: this.profile.totalRuns,
      deaths: this.profile.deaths,
      streakLongest: this.streak.longest,
    };
  }

  /** Last `n` days as calendar cells (oldest→newest). */
  calendar(
    n: number,
    today = utcDateString(),
  ): { date: string; played: boolean; medalRank: number }[] {
    const cells: { date: string; played: boolean; medalRank: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = shiftDate(today, -i);
      const e = this.daily[d];
      cells.push({ date: d, played: !!e, medalRank: e ? medalRank(e.medal) : 0 });
    }
    return cells;
  }

  /** Best daily score for each of the last `n` days (for the sparkline). */
  dailyHistory(n: number, today = utcDateString()): number[] {
    const out: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = shiftDate(today, -i);
      out.push(this.daily[d]?.best ?? 0);
    }
    return out;
  }

  // ---- writes -------------------------------------------------------------

  equipSkin(id: string): void {
    if (this.profile.unlockedSkins.includes(id)) {
      this.profile.equippedSkin = id;
      this.saveProfile();
    }
  }

  recordRun(res: RunResult, now = Date.now()): RecordOutcome {
    const p = this.profile;
    p.totalRuns += 1;
    p.deaths += 1;
    p.lifetimeNearMisses += res.nearMisses;
    p.lifetimePickups += res.pickups;
    p.bestScore = Math.max(p.bestScore, res.score);
    p.bestMedalRank = Math.max(p.bestMedalRank, medalRank(res.medal));
    p.recentRuns.unshift({
      mode: res.mode,
      score: res.score,
      near: res.nearMisses,
      medal: res.medal,
      ts: now,
    });
    p.recentRuns = p.recentRuns.slice(0, 10);

    let isDailyBest = false;
    if (res.mode === 'daily' && res.date) {
      isDailyBest = this.applyDaily(res, now);
    }

    // weekly variable-reward drop
    let weeklyDrop: string | null = null;
    if (now - p.lastWeeklyDropTs >= WEEK_MS) {
      weeklyDrop = this.grantRandomLocked();
      if (weeklyDrop) p.lastWeeklyDropTs = now;
    }

    const newlyUnlocked = this.evaluateUnlocks();
    this.saveProfile();
    return { newlyUnlocked, weeklyDrop, isDailyBest };
  }

  private applyDaily(res: RunResult, now: number): boolean {
    const date = res.date as string;
    const existing = this.daily[date];
    const firstToday = !existing;
    const entry: DailyEntry = existing ?? {
      attempts: 0,
      best: 0,
      near: 0,
      medal: 'none',
      ghost: [],
      bestTs: now,
    };
    entry.attempts += 1;
    let isBest = false;
    if (res.score > entry.best) {
      entry.best = res.score;
      entry.near = res.nearMisses;
      entry.medal = res.medal;
      entry.bestTs = now;
      if (res.ghostLog) entry.ghost = [...res.ghostLog];
      isBest = true;
    }
    this.daily[date] = entry;
    this.saveDaily();

    if (firstToday) this.bumpStreak(date);
    return isBest;
  }

  private bumpStreak(date: string): void {
    const s = this.streak;
    if (s.lastPlayed === date) return;
    if (s.lastPlayed === '') {
      s.current = 1;
    } else {
      const gap = daysBetween(s.lastPlayed, date);
      if (gap === 1) {
        s.current += 1;
      } else if (gap === 2 && s.freezes > 0) {
        s.freezes -= 1; // freeze covers the single missed day
        s.current += 1;
      } else {
        s.current = 1;
      }
    }
    s.lastPlayed = date;
    if (s.current > s.longest) s.longest = s.current;
    // earn a freeze at each 7-day milestone
    if (s.current > 0 && s.current % 7 === 0) s.freezes += 1;
    this.saveStreak();
  }

  private evaluateUnlocks(): string[] {
    const agg = this.aggregate();
    const unlocked: string[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.profile.unlockedSkins.includes(a.skin) && a.test(agg)) {
        this.profile.unlockedSkins.push(a.skin);
        unlocked.push(a.skin);
      }
    }
    return unlocked;
  }

  private grantRandomLocked(): string | null {
    const all = ACHIEVEMENTS.map((a) => a.skin).concat('ghost');
    const locked = all.filter((id) => !this.profile.unlockedSkins.includes(id));
    if (!locked.length) return null;
    const pick = locked[Math.floor(Math.random() * locked.length)] as string;
    this.profile.unlockedSkins.push(pick);
    return pick;
  }

  private saveProfile(): void {
    writeJSON(K_PROFILE, this.profile);
  }
  private saveDaily(): void {
    writeObfuscated(K_DAILY, this.daily);
  }
  private saveStreak(): void {
    writeJSON(K_STREAK, this.streak);
  }
}

function shiftDate(date: string, deltaDays: number): string {
  const t = Date.parse(date + 'T00:00:00Z') + deltaDays * 86400000;
  return utcDateString(new Date(t));
}
