# COMET (working codename)

A viral **one-touch skill arcade** game with a **daily shared-seed run** mode —
Wordle's retention engine bolted onto a Flappy-Bird-style core loop.

- **Practice mode:** unlimited runs on random seeds — the "one more try" loop.
- **Daily mode:** every player on Earth gets the identical seeded run each day,
  3 attempts, shareable emoji result card, streaks. _(Phase 5+)_

## Status: Phase 1 — Three graybox prototypes ✅

Three one-touch mechanics built on the shared engine for the Phase 2 fun-gate
bake-off. Rectangles and circles only — no art, no juice, no menus.

| Route      | Mechanic   | One-touch control                                                        |
| ---------- | ---------- | ------------------------------------------------------------------------ |
| `/proto/a` | **CHARGE** | Hold to charge, release to launch — hold length sets launch power. Thread scrolling gaps. |
| `/proto/b` | **ORBIT**  | Orbit an anchor; tap to release along the tangent and coast to the next anchor. Auto-scroll = forward pressure. |
| `/proto/c` | **FLIP**   | Tap flips gravity; the comet falls to the opposite surface. Obstacles on floor and ceiling. |

Shared prototype harness (`src/proto/shared/`): seeded reset, difficulty ramp
(speed up + gap tighten), scoring (distance + pickups + near-miss bonus),
near-miss detection, instant tap-to-restart, per-run telemetry to
console + localStorage, and the HUD. Each mechanic owns only its world,
physics, collision and graybox render. Tunable constants live in one
`config.ts` per prototype.

Add `?seed=NAME` to any prototype URL for a fixed, replayable obstacle layout.

### Visual + juice layer

A real feel/juice pass sits on top of the graybox mechanics (a preview of the
Phase 4 work, kept mechanic-agnostic in the shared layer):

- **Juice system** (`src/juice/juice.ts`) — particles, screen shake, hitstop,
  a WebAudio synth (tap / pickup / near-miss / death / new-best, with pitch
  variance), and a full-screen flash. Honours `prefers-reduced-motion`
  (motion off, game fully playable) and a persisted **mute** toggle (`M`).
- **Backdrop** (`src/ui/backdrop.ts`) — deep-space gradient, parallax
  starfield, drifting nebula, vignette.
- **Comet** (`src/ui/comet.ts`) — glowing body with a fading motion trail and
  squash/stretch toward travel direction; obstacles/pickups glow
  (`src/ui/shapes.ts`).
- Near misses flash + chime + combo-pitch escalation; deaths burst + shake +
  hitstop; new bests fanfare. All wired once in the shared harness.

### Phase 0 — Engine core ✅

The shared engine every prototype builds on. A hello-world scene at `/`
(menu → game → results) exercises the engine end to end.

### What's in the engine (`src/engine/`)

| Module      | Responsibility                                                             |
| ----------- | ------------------------------------------------------------------------- |
| `loop.ts`   | Fixed-timestep update at **60Hz**, decoupled from rAF render with `alpha` interpolation; spiral-of-death protection; live perf stats. |
| `input.ts`  | Unified pointer + keyboard(Space) layer → `press`/`hold`/`release` events with DOM timestamps; event→render **latency** sampling. |
| `rng.ts`    | `mulberry32` seeded PRNG + xmur3 string hash. Same seed ⇒ identical sequence everywhere (the daily-run guarantee). |
| `scene.ts`  | Scene manager (menu / game / results) with deferred, safe transitions.    |
| `debug.ts`  | Debug overlay: FPS, frame/update/render ms, input latency, panics. Toggle with `` ` ``. |
| `app.ts`    | Wires canvas + DPR/resize, input, juice, scenes, loop, debug into one `AppContext`. |

`src/juice/juice.ts` — no-op stubs (`burst`, `shake`, `hitstop`, `tone`) so
game code can call the juice layer today; real implementation lands in Phase 4.

## Stack

Vanilla **TypeScript + Canvas 2D**, **Vite**, ESLint, Prettier, Vitest.

> **Why not Phaser 3?** The core loop is a single scrolling obstacle field with
> a fixed-timestep + input-log-replay requirement (Phase 7 anti-cheat) and a
> <100KB gzipped JS budget (Phase 9). Vanilla Canvas 2D keeps full control of
> the timestep and juice with near-zero framework weight. Revisit if a
> prototype genuinely needs a scene/physics framework.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # RNG determinism + bounds (Vitest)
npm run typecheck    # strict tsc, no emit
npm run lint
npm run build        # tsc --noEmit && vite build → dist/
```

### Tests

- **RNG + obstacle determinism** — automated: `npm test`
  (`src/engine/rng.test.ts`, `src/proto/proto.test.ts`). Same seed ⇒ identical
  obstacle layout for all three prototypes.
- **Prototype stability** — 20 consecutive death→restart runs per prototype,
  crash-free, verified headlessly (see `scripts/`-style harness in the Phase 1
  report). Restart is synchronous on tap (≪800ms pillar).
- **60fps hold / input latency <50ms** — runtime: open any scene, press `` ` ``
  for the debug overlay. Latency turns red if it exceeds 50ms. Verify under
  Chrome DevTools 4× CPU throttle.
- **Median run length + deaths/min** — captured per run in
  `localStorage['comet:telemetry:<id>']` and logged to console; meaningful
  numbers come from the Phase 2 human playtest, not bots.

## Deploy (free tier)

Static build in `dist/`. Zero config on either:

- **Vercel** — import the repo; framework auto-detected as Vite.
- **Cloudflare Pages** — build command `npm run build`, output dir `dist`.

## Moving this to its own repository

This project currently lives on the `claude/comet-arcade-game-0yfh4q` branch
(the automated GitHub integration couldn't create a new repo from the session).
To give it a dedicated home:

```bash
# create an empty repo on github.com first (e.g. comet-arcade-game), then:
git remote add comet https://github.com/<you>/comet-arcade-game.git
git push comet claude/comet-arcade-game-0yfh4q:main
```

## Build roadmap

Phase 0 scaffold ✅ → 1 graybox prototypes (CHARGE/ORBIT/FLIP) ✅ → **2 fun gate
(hard stop, human playtest)** ← _next_ → 3 core loop → 4 juice → 5 daily →
6 share → 7 leaderboard → 8 meta → 9 PWA → 10 analytics & soft launch.
