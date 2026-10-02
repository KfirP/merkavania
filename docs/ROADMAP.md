# Merkavania: Roadmap

Current target: **Vertical slice** (desert biome, M0–M8). Tick milestones off as they're completed.

## M0: Scaffold ✅
- [x] `git init`, Vite + TypeScript (strict) + Phaser 3, npm scripts from CLAUDE.md (`dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `validate:maps`, `check`)
- [x] ESLint (with `no-restricted-imports` banning `phaser` in `src/logic/**`), Prettier
- [x] Vitest + Playwright set up, with one passing test each
- [x] Folder layout per `ARCHITECTURE.md`; integer-scaled 480×270 canvas; Boot/Preload/Title/World scenes stubbed
- [x] GitHub Actions: `ci.yml`, `deploy.yml` (Pages, `VITE_BASE`) (green on first push; Pages live at https://kfirp.github.io/merkavania/)
- [x] PixelLab + ElevenLabs MCP connected (see `ASSET_PIPELINE.md`)

## M1: Tank feel ✅
- [x] `TankCommand` + keyboard/mouse, gamepad and touch (dual stick) adapters
- [x] Mk2 tank: hull momentum/turning, turret traverse, main gun + coax MG, placeholder sprites
- [x] Debug overlay basics (`?debug=1`, bodies, FPS)
- [x] Test room in Tiled format (`public/maps/test/test_room.tmj`)
- [x] Feel review: played on keyboard/mouse and touch; controls reworked (right-click cannon, touch release-to-fire, MG mode toggle)

## M2: World ✅
- [x] `.world` loading + `ChunkStreamer` (3×3 load, 5×5 unload); the test room is now the 4×2 `test` world
- [x] Elevation grid, ramps, cliff edges, level-filtered collision (walls and projectiles; entity-vs-entity filtering lands with enemies in M3), depth sorting
- [x] Terrain rules from `data/terrain.ts` (speed multipliers, ability/pawn gates; hazard damage waits for M3)
- [x] `validate:maps` v1 (structure, ids, edges)

## M3: Combat ✅
- [x] Damage model (`logic/combat`), rear-arc bonus, destructible materials, hazard damage, death and respawn (at `start` until M4's depots)
- [x] Desert enemies: `rifle_squad`, `technical`, `bunker_mg`, `atgm_team`, `light_tank` (brain state machine, line of sight, guided ATGMs, entity-vs-entity level filtering)
- [x] Explosions, hit feedback, screen shake; PixelLab sprites for enemies, destructibles and explosions (the rifle soldier stays a placeholder)

## M4: Progression & saves ✅
- [x] `GameState`, abilities, pickups (saved on collection), persistent flags per `<chunkId>:<id>`
- [x] Gates: `rubble`/dozer (plus dozer-shoved `boulder`s), `mortar` arc + mortar switches, cannon switches, doors
- [x] Depots (drive onto the pad), 3 save slots (slot 1 or `?slot=N` until M6's slot select), versioned save + migrations, respawn at the last depot
- [x] `validate:maps` rule 6, progression reachability
- [x] Test world row y02, the progression gallery; e2e specs for every gate and the save loop
- Carried over: rubble doesn't change look once the dozer can cross it (M7 art)

## M5: Rear hatch ✅
- [x] Pawn switching (`PawnSystem`), scout pawn with a light rifle, `crawlspace`, walk-on scout switches, recall (auto-walk on a BFS route) and walk-back boarding, leash
- [x] Enemies target the closest visible pawn; the HUD follows the active pawn; touch hatch button
- [x] `validate:maps` rule 6 counts pickups the scout can reach
- [x] Test world M5 corner (x03_y02); `hatch.spec.ts` plus touch and gamepad hatch specs

## M6: UI & i18n ✅
- [x] HUD (Mk tier, gun rounds, HP, selected secondary and ammo, repair kits, 3×3 minimap), map screen, pause menu, settings (language, touch controls, volumes, keybinds), title/slot select
- [x] i18n with `en`/`he`, RTL text and a mirrored HUD; Public Pixel (CC0) as the UI font, its Hebrew coverage checked by a test
- [x] Touch UI polish (pause, map, swap and repair buttons; touch-controls setting), rotate-device prompt
- [x] Repair kit charges (carried over from M4): R / X / touch button, refilled at depots; save v2

## M7: Vertical slice content
- [ ] Desert biome, 15–20 chunks, per the `GAME_DESIGN.md` slice spec
- [ ] `boss_desert`, Mk3 upgrade (sprites, 120mm, `suspension` + steep ramps)
- [ ] Radio messages, final generated art replacing placeholders

## M8: Polish & audio
- [ ] ElevenLabs SFX + desert music, AudioSystem with volume settings
- [ ] Playwright smoke suite covering boot → play → gate → save/load
- [ ] Performance pass on mobile; public deploy

## Later
- Biome 2 `hills` (`ammo_heat`, `snorkel`), biome 3 `city` (`ammo_apfsds`, `mine_plow`, `smoke`), biome 4 `underground` (`wide_tracks`, `lahat`, `hatch_drone`, Mk4 + `trophy`), biome 5 `core` finale
- Drone pawn, remaining enemies/bosses, full-map polish, credits/ending
