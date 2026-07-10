import './ui/style.css';
import { App } from './engine/app';
import { MenuScene } from './game/scenes/menu';
import { GameScene } from './game/scenes/game';
import { ResultsScene } from './game/scenes/results';
import { utcDateString } from './game/dailySeed';
import { hashSeed } from './engine/rng';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('main: #game canvas not found');

const today = utcDateString();

const app = new App({
  canvas,
  scenes: [new MenuScene(), new GameScene(), new ResultsScene()],
  start: 'menu',
  debugInfo: () => ({
    date: today,
    seed: hashSeed(`comet-daily-${today}`),
  }),
});

// Pause the loop when the tab is hidden; resume on return (no penalty).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.stop();
  else app.start();
});

app.start();
