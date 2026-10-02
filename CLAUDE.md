# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Merkavania** is a web metroidvania with top-down pixel art. The player drives a Merkava tank. It starts as a Mk2 and upgrades to Mk3 and then Mk4; each Mk tier is a major milestone. Other upgrades are pickups that open new areas. The stack is Phaser 3, TypeScript, Vite and Tiled. It targets desktop browsers (keyboard/mouse and gamepad) and mobile (touch), and deploys to GitHub Pages.

**Status:** M0–M4 complete; next up is M5 (rear hatch: pawn switching, the scout, `crawlspace`, scout switches, recall). See `docs/ROADMAP.md` for the current milestone. The commands below are the `package.json` scripts. If you change a script name, update this file too. Phaser is pinned to 3.x (`phaser@^3`); don't upgrade to Phaser 4 without an explicit decision.

Design docs (read the relevant one before working in its area):
- `docs/GAME_DESIGN.md`: mechanics, Mk tiers, the ability→gate table, biomes and the vertical-slice spec. This is the source of truth for ability and terrain ids.
- `docs/ARCHITECTURE.md`: code structure, scenes, elevation, chunk streaming, saves, i18n, debug tools and deployment.
- `docs/LEVEL_DESIGN.md`: Tiled layer, property and object conventions, and what the map validator enforces.
- `docs/ASSET_PIPELINE.md`: PixelLab and ElevenLabs MCP usage, art and audio conventions, the asset manifest.
- `docs/ROADMAP.md`: milestones and the current target.

## Commands

```
npm run dev            # Vite dev server (add ?debug=1 to the URL for the debug overlay)
npm run build          # typecheck + production build to dist/
npm run preview        # serve dist/
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint + Prettier check
npm test               # Vitest, all unit tests (src/logic, scripts)
npx vitest run src/logic/progression.test.ts -t "grants mk3"   # single test file/name
npm run test:e2e       # Playwright smoke tests (starts the dev server itself)
npx playwright test tests/e2e/boot.spec.ts                      # single e2e spec
npm run validate:maps  # check every Tiled map/world under public/maps
npm run check          # typecheck + lint + test + validate:maps (what CI runs)
```

## Architecture (big picture)

- **Two layers, one rule:** `src/logic/` is pure TypeScript game rules: progression, ability gating, damage, save (de)serialization, map validation rules and the world graph. It **must not import Phaser**; ESLint enforces this with `no-restricted-imports`. `src/game/` holds the Phaser scenes, entities and systems, which read and change logic state. Anything that can be unit-tested belongs in `src/logic/`.
- **Data-driven balance:** every tunable number lives in `src/data/`: Mk tier stats, weapons and ammo, enemies, abilities and the asset manifest. Entities look values up by id and never hardcode balance.
- **Scenes:** Boot → Preload → Title → `WorldScene` (gameplay). `HudScene` and `TouchControlsScene` run in parallel on top of it. `MapScene`, `PauseScene` and `DebugScene` are overlays. Scenes talk through a typed event bus plus the shared `GameState` (from `src/logic/`); they never reach into each other's objects.
- **Input pipeline:** keyboard/mouse, gamepad and touch adapters each produce a `TankCommand` (throttle, turn, aimAngle, fire, altFire, hatch, …) every frame. Pawns only ever consume `TankCommand`, never raw devices.
- **Pawns:** the tank, the infantry scout (rear-hatch ability) and later the drone are all pawns driven by the same command pipeline. Only one pawn is active at a time and the camera follows it.
- **World streaming:** each biome is a Tiled `.world` file made of chunk maps (30×17 tiles). `ChunkStreamer` keeps the player's chunk and its 8 neighbours loaded and unloads the rest. Chunk visits are recorded for the map screen.
- **Elevation:** every tile and entity has an integer `level`. Collisions only happen between things on the same level. A pawn changes level only on ramp tiles, and cliffs are derived edges between cells of different level. Render depth is sorted by level, then y. Mortar shells are the exception: they travel in an arc, ignore levels and land on the level of the tile they hit. Details are in `docs/ARCHITECTURE.md`.
- **Saves:** repair depots heal the tank and save the game. Saves are versioned JSON in localStorage (`merkavania.save.<slot>`). **Any change to the save shape needs a `SAVE_VERSION` bump plus a migration in `src/logic/save/migrations.ts` with a test.**

## Workflow: test-driven

From M2 onward, every change is test-first:
1. **Red:** write the test for the new behaviour and run it to see it fail for the expected reason.
2. **Green:** write the minimum code that makes it pass.
3. **Refactor** with the tests green, then run `npm run check` (and `npm run test:e2e` for scene behaviour).

- Rules and math go in `src/logic/` and get Vitest tests. If game code needs a decision or a formula, extract it into `src/logic/` so it can be tested first. Keep `src/game/` a thin Phaser shell.
- Behaviour that only exists in a running scene (collisions, input devices, overlays) gets a Playwright spec in `tests/e2e/`, driven through `window.__merkavania` debug hooks. Add a hook when a spec needs to observe something new.
- Data tables (`src/data/`) and maps get sanity tests: every referenced id and asset key exists and every value is in range.
- A bug fix starts with a test that reproduces the bug.

## Conventions

- Ability, terrain, material, object-type and enemy ids are `snake_case` strings defined once, in `src/data/`, and mirror `docs/GAME_DESIGN.md` and `docs/LEVEL_DESIGN.md`. Adding an id means updating the data table, the validator and the doc together.
- All player-facing text goes through i18n keys (`src/i18n/en.json`, `src/i18n/he.json`). Hebrew is RTL, so render it with Phaser `Text` using `rtl: true`. Never put literal UI strings in code.
- Assets are referenced only through `src/data/assetManifest.ts` keys, never raw paths. Placeholder art generated in code is fine until the real asset exists; the manifest records which assets are placeholders.
- Render at 480×270 internal resolution on a 16px grid with `pixelArt: true` and integer scaling. The tank is about 32×32. Top-down 90° sprites face **east** and are rotated in the engine.
- Tiled maps are saved as JSON (`.tmj` maps, external `.tsj` tilesets) under `public/maps/<biome>/`. Run `npm run validate:maps` after editing any map.
- Art and audio are generated through MCP servers (PixelLab and ElevenLabs; see `docs/ASSET_PIPELINE.md`). Raw generations go in `assets-src/` and processed game-ready files in `public/assets/`.
