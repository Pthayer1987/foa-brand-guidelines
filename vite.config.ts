import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page setup: the shell (index) plus the three Phase 1 prototype pages.
// Prototype HTML files are added in Phase 1; guarded with existsSync so the
// build stays green until they land.
import { existsSync } from 'node:fs';

const root = import.meta.dirname;
const input: Record<string, string> = {
  main: resolve(root, 'index.html'),
};
for (const proto of ['a', 'b', 'c']) {
  const p = resolve(root, `proto/${proto}/index.html`);
  if (existsSync(p)) input[`proto-${proto}`] = p;
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input },
    // Fail the build if the gzipped JS budget balloons (Phase 9 pillar: <100KB).
    chunkSizeWarningLimit: 100,
  },
  server: {
    host: true,
    port: 5173,
  },
});
