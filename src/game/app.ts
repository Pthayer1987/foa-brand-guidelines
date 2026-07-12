import { JuiceSystem } from '../juice/juice';
import { buildUI, drawSparkline, type UIRefs } from './ui/screens';
import { toast } from './ui/dom';
import { PlayController, type RunEnd } from './play';
import { GameStore } from './state/store';
import { utcDateString } from './dailySeed';
import { medalFor } from './core/config';
import { SKINS, skinById } from './core/skins';
import { ACHIEVEMENTS } from './state/achievements';
import { shareResult, dayNumber } from './share';

type ScreenId = 'home' | 'game' | 'results' | 'stats';
const MAX_ATTEMPTS = 3;

/** Top-level game controller: router + screens + run lifecycle. */
export class GameApp {
  private readonly ui: UIRefs;
  private readonly store = new GameStore();
  private readonly juice = new JuiceSystem();
  private readonly play: PlayController;

  private current: ScreenId = 'home';
  private runMode: 'practice' | 'daily' = 'practice';
  private runDate = utcDateString();
  private preRunBest = 0;

  constructor(root: HTMLElement) {
    this.ui = buildUI(root);
    this.play = new PlayController(this.ui.canvas, this.juice);
    this.wire();
    this.refreshHome();
    this.show('home');

    setTimeout(() => this.tickCountdown(), 0);
    window.setInterval(() => this.tickCountdown(), 1000);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') toast(this.juice.toggleMute() ? '🔇 Muted' : '🔊 Sound on');
    });
    window.addEventListener('resize', () => this.play.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.play.pause();
      else if (this.current === 'game') this.play.resume();
    });
  }

  // ---- routing ------------------------------------------------------------

  private show(id: ScreenId): void {
    this.current = id;
    for (const [key, el] of Object.entries(this.ui.screens)) {
      el.classList.toggle('active', key === id);
    }
  }

  private wire(): void {
    this.ui.btnDaily.addEventListener('click', () => this.startDaily());
    this.ui.btnPractice.addEventListener('click', () => this.startPractice());
    this.ui.btnStats.addEventListener('click', () => this.openStats());
    this.ui.btnStatsClose.addEventListener('click', () => {
      this.refreshHome();
      this.show('home');
    });
    this.ui.btnResHome.addEventListener('click', () => {
      this.refreshHome();
      this.show('home');
    });
    this.ui.btnAgain.addEventListener('click', () => {
      if (this.runMode === 'daily') this.startDaily();
      else this.startPractice();
    });
    this.ui.btnShare.addEventListener('click', () => this.doShare());
  }

  // ---- runs ---------------------------------------------------------------

  private startPractice(): void {
    this.runMode = 'practice';
    this.preRunBest = this.store.bestScore;
    const seed = `practice-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    this.beginRun({ mode: 'practice', seed });
  }

  private startDaily(): void {
    const date = utcDateString();
    this.runDate = date;
    if (this.store.attemptsLeft(date, MAX_ATTEMPTS) <= 0) {
      toast('No attempts left — come back tomorrow');
      return;
    }
    this.runMode = 'daily';
    this.preRunBest = this.store.dailyFor(date)?.best ?? 0;
    const played = this.store.dailyFor(date);
    const ghostLog = played && played.attempts >= 1 ? played.ghost : undefined;
    this.beginRun({
      mode: 'daily',
      date,
      seed: `comet-daily-${date}`,
      ...(ghostLog && ghostLog.length ? { ghostLog } : {}),
    });
  }

  private beginRun(opts: {
    mode: 'practice' | 'daily';
    date?: string;
    seed: string;
    ghostLog?: readonly number[];
  }): void {
    const skin = skinById(this.store.equippedSkin);
    this.show('game');
    this.play.resize();
    this.juice.sfxStart();
    this.ui.tapHint.classList.add('show');
    this.updateHud(0, 1, opts.mode, opts.date);

    let hintShown = true;
    this.play.start(
      {
        mode: opts.mode,
        seed: opts.seed,
        ...(opts.date ? { date: opts.date } : {}),
        skin,
        ...(opts.ghostLog ? { ghostLog: opts.ghostLog } : {}),
      },
      {
        onFrame: (sim) => {
          if (hintShown && sim.elapsed > 0.15 && (sim.gravitySign === -1 || sim.vy !== 0)) {
            this.ui.tapHint.classList.remove('show');
            hintShown = false;
          }
          this.updateHud(sim.score, sim.multiplier, opts.mode, opts.date);
        },
        onEnd: (r) => this.endRun(r),
      },
    );
  }

  private updateHud(score: number, mult: number, mode: 'practice' | 'daily', date?: string): void {
    this.ui.hudScore.textContent = String(score);
    this.ui.hudCombo.textContent = mult > 1 ? `×${mult}` : '';
    if (mode === 'daily' && date) {
      const left = this.store.attemptsLeft(date, MAX_ATTEMPTS);
      this.ui.hudAttempts.textContent = `DAILY · ${left} left`;
    } else {
      this.ui.hudAttempts.textContent = 'PRACTICE';
    }
  }

  private endRun(r: RunEnd): void {
    const outcome = this.store.recordRun({
      mode: r.mode,
      ...(r.date ? { date: r.date } : {}),
      score: r.score,
      nearMisses: r.nearMisses,
      pickups: r.pickups,
      medal: r.medal,
      ghostLog: r.flipLog,
    });

    for (const skin of outcome.newlyUnlocked) {
      toast(`🎉 Unlocked: ${skinById(skin).name}`);
    }
    if (outcome.weeklyDrop) {
      toast(`✨ Weekly drop: ${skinById(outcome.weeklyDrop).name}!`);
    }

    const isNewBest =
      r.mode === 'daily' ? outcome.isDailyBest : r.score > this.preRunBest && r.score > 0;
    if (isNewBest) this.juice.sfxBest();

    this.renderResults(r, outcome.isDailyBest);
    this.show('results');
  }

  private renderResults(r: RunEnd, dailyBest: boolean): void {
    const u = this.ui;
    const medal = medalFor(r.score);
    u.resTitle.textContent = r.mode === 'daily' ? `DAILY #${dayNumber(r.date)}` : 'PRACTICE';
    u.resMedal.textContent = `${medal.emoji} ${medal.label}`;
    u.resScore.textContent = String(r.score);

    const isNewBest = r.mode === 'daily' ? dailyBest : r.score > this.preRunBest && r.score > 0;
    u.resNewBest.classList.toggle('show', isNewBest);

    const secs = (r.timeMs / 1000).toFixed(1);
    u.resSub.textContent = `✨ ${r.nearMisses} near · ⏱ ${secs}s · ◎ ${r.pickups}`;

    if (r.mode === 'daily') {
      const s = this.store.streakInfo;
      const left = this.store.attemptsLeft(r.date as string, MAX_ATTEMPTS);
      u.resStreak.textContent = `🔥 ${s.current} day streak · ${left} attempt${left === 1 ? '' : 's'} left`;
      u.btnAgain.textContent = left > 0 ? 'TRY AGAIN' : 'DONE FOR TODAY';
      u.btnAgain.disabled = left <= 0;
      drawSparkline(u.resSpark, this.store.dailyHistory(14));
    } else {
      u.resStreak.textContent = `best ${this.store.bestScore}`;
      u.btnAgain.textContent = 'PLAY AGAIN';
      u.btnAgain.disabled = false;
      drawSparkline(
        u.resSpark,
        [...this.store.recentRuns].reverse().map((x) => x.score),
      );
    }
  }

  private async doShare(): Promise<void> {
    const last = this.store.recentRuns[0];
    if (!last) return;
    const res = await shareResult({
      score: last.score,
      nearMisses: last.near,
      streak: this.store.streakInfo.current,
      ...(this.runMode === 'daily' ? { date: this.runDate } : {}),
    });
    if (res.method === 'clipboard') toast('Copied to clipboard');
    else if (res.method === 'download') toast('Saved share image');
    else if (res.method === 'none') toast('Share unavailable');
  }

  // ---- home / stats -------------------------------------------------------

  private refreshHome(): void {
    const date = utcDateString();
    const left = this.store.attemptsLeft(date, MAX_ATTEMPTS);
    const s = this.store.streakInfo;
    this.ui.homeStreak.textContent = `🔥 ${s.current}${s.freezes > 0 ? ` · ❄️${s.freezes}` : ''}`;
    this.ui.dailySub.textContent =
      left > 0 ? `${left} attempt${left === 1 ? '' : 's'} left` : 'done today';
    this.ui.practiceBest.textContent = `best ${this.store.bestScore}`;
    this.ui.btnDaily.classList.toggle('done', left <= 0);
    this.ui.homeSkin.textContent = `☄️ ${skinById(this.store.equippedSkin).name}`;
  }

  private tickCountdown(): void {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const ms = next - now.getTime();
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    this.ui.dailyNote.textContent = `next in ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }

  private openStats(): void {
    const u = this.ui;
    const stat = (label: string, value: string | number) =>
      `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${label}</div></div>`;
    const s = this.store.streakInfo;
    u.statGrid.innerHTML =
      stat('Best', this.store.bestScore) +
      stat('Runs', this.store.totalRuns) +
      stat('Near misses', this.store.lifetimeNearMisses) +
      stat('Pickups', this.store.lifetimePickups) +
      stat('Streak', s.current) +
      stat('Longest', s.longest);

    // calendar
    u.calendar.innerHTML = '';
    for (const cell of this.store.calendar(28)) {
      const d = document.createElement('div');
      d.className = 'cal-cell' + (cell.played ? ` played m${cell.medalRank}` : '');
      d.title = cell.date;
      u.calendar.append(d);
    }

    // skins
    u.skinGrid.innerHTML = '';
    const unlocked = new Set(this.store.unlockedSkins);
    const descFor = (id: string) => ACHIEVEMENTS.find((a) => a.skin === id)?.desc ?? 'Weekly drop';
    for (const skin of SKINS) {
      const has = unlocked.has(skin.id);
      const cell = document.createElement('button');
      cell.className =
        'skin' + (has ? '' : ' locked') + (this.store.equippedSkin === skin.id ? ' on' : '');
      cell.innerHTML = `<span class="swatch" style="--c:${skin.body};--g:${skin.glow}"></span><span class="skin-n">${has ? skin.name : '🔒'}</span>`;
      cell.title = has ? skin.name : descFor(skin.id);
      if (has) {
        cell.addEventListener('click', () => {
          this.store.equipSkin(skin.id);
          this.openStats();
        });
      }
      u.skinGrid.append(cell);
    }

    this.show('stats');
  }
}
