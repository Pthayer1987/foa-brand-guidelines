# COMET (working codename)

A viral **one-touch skill arcade** game with a **daily shared-seed run** mode —
Wordle's retention engine bolted onto a Flappy-Bird-style core loop.

- **Practice mode:** unlimited runs on random seeds — the "one more try" loop.
- **Daily mode:** every player on Earth gets the identical seeded run each day,
  3 attempts, shareable emoji result card, streaks. _(Phase 5+)_

## Status: Phase 0 — Project scaffold & engine core ✅

The shared engine every prototype will build on. **No gameplay yet** — a
hello-world scene (menu → game → results) exercises the engine end to end.

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

### Phase 0 tests

- **RNG determinism** — automated: `npm test` (`src/engine/rng.test.ts`).
- **60fps hold / input latency <50ms** — runtime: open the app, press `` ` ``
  for the debug overlay. Latency turns red if it exceeds 50ms. Verify under
  Chrome DevTools 4× CPU throttle.

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

Phase 0 scaffold ✅ → 1 graybox prototypes (CHARGE/ORBIT/FLIP) → **2 fun gate
(hard stop, human playtest)** → 3 core loop → 4 juice → 5 daily → 6 share →
7 leaderboard → 8 meta → 9 PWA → 10 analytics & soft launch.
