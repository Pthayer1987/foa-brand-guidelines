import './ui/style.css';
import { GameApp } from './game/app';
import { registerServiceWorker, initInstallPrompt } from './game/pwa';

const root = document.getElementById('app');
if (!root) throw new Error('main: #app not found');

new GameApp(root);

registerServiceWorker();
initInstallPrompt();
