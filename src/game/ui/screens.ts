import { h } from './dom';

export interface UIRefs {
  screens: Record<'home' | 'game' | 'results' | 'stats', HTMLElement>;
  canvas: HTMLCanvasElement;

  // home
  homeStreak: HTMLElement;
  dailySub: HTMLElement;
  dailyNote: HTMLElement;
  practiceBest: HTMLElement;
  btnDaily: HTMLButtonElement;
  btnPractice: HTMLButtonElement;
  btnStats: HTMLButtonElement;
  homeSkin: HTMLElement;

  // game HUD
  hudScore: HTMLElement;
  hudCombo: HTMLElement;
  hudAttempts: HTMLElement;
  tapHint: HTMLElement;

  // results
  resTitle: HTMLElement;
  resNewBest: HTMLElement;
  resMedal: HTMLElement;
  resScore: HTMLElement;
  resSub: HTMLElement;
  resStreak: HTMLElement;
  resSpark: HTMLCanvasElement;
  btnAgain: HTMLButtonElement;
  btnShare: HTMLButtonElement;
  btnResHome: HTMLButtonElement;

  // stats
  statGrid: HTMLElement;
  calendar: HTMLElement;
  skinGrid: HTMLElement;
  btnStatsClose: HTMLButtonElement;
}

export function buildUI(root: HTMLElement): UIRefs {
  // ---- HOME ----
  const homeStreak = h('div', { class: 'streak-badge' }, '🔥 0');
  const btnStats = h('button', { class: 'icon-btn', 'aria-label': 'Stats' }, '▦');
  const dailySub = h('span', { class: 'big-sub' }, '3 attempts left');
  const dailyNote = h('span', { class: 'big-note' }, 'next in —');
  const practiceBest = h('span', { class: 'big-sub' }, 'best 0');
  const homeSkin = h('div', { class: 'home-skin' }, '');
  const btnDaily = h(
    'button',
    { class: 'big-btn daily' },
    h('span', { class: 'big-title' }, 'DAILY'),
    dailySub,
    dailyNote,
  );
  const btnPractice = h(
    'button',
    { class: 'big-btn practice' },
    h('span', { class: 'big-title' }, 'PRACTICE'),
    practiceBest,
  );
  const home = h(
    'section',
    { class: 'screen home' },
    h('div', { class: 'home-top' }, h('div', { class: 'brand' }, 'COMET'), btnStats),
    homeStreak,
    h('div', { class: 'home-buttons' }, btnDaily, btnPractice),
    h('div', { class: 'home-foot' }, homeSkin, h('span', {}, 'tap = flip gravity · M mute')),
  );

  // ---- GAME ----
  const canvas = h('canvas', { id: 'game' }) as HTMLCanvasElement;
  const hudScore = h('div', { class: 'hud-score' }, '0');
  const hudCombo = h('div', { class: 'hud-combo' }, '');
  const hudAttempts = h('div', { class: 'hud-attempts' }, '');
  const tapHint = h('div', { class: 'tap-hint' }, 'tap to flip gravity');
  const game = h(
    'section',
    { class: 'screen game' },
    canvas,
    h('div', { class: 'hud' }, hudAttempts, hudScore, hudCombo),
    tapHint,
  );

  // ---- RESULTS ----
  const resTitle = h('div', { class: 'res-title' }, 'PRACTICE');
  const resNewBest = h('div', { class: 'res-newbest' }, '★ NEW BEST ★');
  const resMedal = h('div', { class: 'res-medal' }, '▫️ —');
  const resScore = h('div', { class: 'res-score' }, '0');
  const resSub = h('div', { class: 'res-sub' }, '');
  const resStreak = h('div', { class: 'res-streak' }, '');
  const resSpark = h('canvas', { class: 'res-spark', width: 320, height: 60 }) as HTMLCanvasElement;
  const btnAgain = h('button', { class: 'btn primary' }, 'PLAY AGAIN');
  const btnShare = h('button', { class: 'btn' }, 'Share');
  const btnResHome = h('button', { class: 'btn ghost' }, 'Home');
  const results = h(
    'section',
    { class: 'screen results' },
    h(
      'div',
      { class: 'res-card' },
      resTitle,
      resNewBest,
      resMedal,
      resScore,
      resSub,
      resStreak,
      resSpark,
      h('div', { class: 'res-buttons' }, btnAgain, btnShare, btnResHome),
    ),
  );

  // ---- STATS ----
  const statGrid = h('div', { class: 'stat-grid' });
  const calendar = h('div', { class: 'calendar' });
  const skinGrid = h('div', { class: 'skin-grid' });
  const btnStatsClose = h('button', { class: 'icon-btn', 'aria-label': 'Close' }, '✕');
  const stats = h(
    'section',
    { class: 'screen stats' },
    h(
      'div',
      { class: 'stats-scroll' },
      h('div', { class: 'stats-top' }, h('div', { class: 'stats-h' }, 'STATS'), btnStatsClose),
      statGrid,
      h('div', { class: 'section-h' }, 'Last 28 days'),
      calendar,
      h('div', { class: 'section-h' }, 'Comets'),
      skinGrid,
    ),
  );

  root.append(home, game, results, stats);

  return {
    screens: { home, game, results, stats },
    canvas,
    homeStreak,
    dailySub,
    dailyNote,
    practiceBest,
    btnDaily,
    btnPractice,
    btnStats,
    homeSkin,
    hudScore,
    hudCombo,
    hudAttempts,
    tapHint,
    resTitle,
    resNewBest,
    resMedal,
    resScore,
    resSub,
    resStreak,
    resSpark,
    btnAgain,
    btnShare,
    btnResHome,
    statGrid,
    calendar,
    skinGrid,
    btnStatsClose,
  };
}

export function drawSparkline(cv: HTMLCanvasElement, values: number[], color = '#4de1c1'): void {
  const c = cv.getContext('2d');
  if (!c) return;
  const w = cv.width;
  const hgt = cv.height;
  c.clearRect(0, 0, w, hgt);
  if (values.length < 2) return;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  c.beginPath();
  values.forEach((v, i) => {
    const x = i * step;
    const y = hgt - 6 - (v / max) * (hgt - 12);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.shadowColor = color;
  c.shadowBlur = 6;
  c.stroke();
  // last point dot
  const lx = (values.length - 1) * step;
  const ly = hgt - 6 - (values[values.length - 1]! / max) * (hgt - 12);
  c.fillStyle = color;
  c.beginPath();
  c.arc(lx, ly, 3, 0, Math.PI * 2);
  c.fill();
}
