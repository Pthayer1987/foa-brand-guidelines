import { App } from '../../engine/app';
import { PrototypeScene, type SeedProvider } from './harness';
import type { Mechanic } from './mechanic';

/**
 * Seed provider for a prototype.
 * - `?seed=X` in the URL → every run uses seed X (deterministic; identical
 *   obstacle layout on replay — the Phase 1 determinism test).
 * - otherwise → a fresh varied seed per run (playtest variety).
 */
function makeSeedProvider(protoId: string): SeedProvider {
  const fixed = new URLSearchParams(location.search).get('seed');
  let n = 0;
  return () => fixed ?? `comet-proto-${protoId}-${n++}-${Math.floor(Math.random() * 1e6)}`;
}

export function bootProto(mech: Mechanic): App {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('bootProto: #game canvas not found');

  const scene = new PrototypeScene(mech, makeSeedProvider(mech.cfg.id));
  const app = new App({
    canvas,
    scenes: [scene],
    start: 'play',
    debugInfo: () => ({ proto: mech.cfg.name }),
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.stop();
    else app.start();
  });

  // Test hook for headless stability checks (harmless in production).
  (window as unknown as { __cometScene?: PrototypeScene }).__cometScene = scene;

  app.start();
  return app;
}
