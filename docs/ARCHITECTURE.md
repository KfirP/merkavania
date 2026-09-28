# Merkavania: Architecture

## Stack
- **Phaser 3** (Arcade physics), **TypeScript** (strict), **Vite**, npm.
- **Vitest** for unit tests and **Playwright** for browser smoke tests.
- **ESLint** + **Prettier**. `tsx` runs Node scripts such as the map validator.
- **Tiled** for maps (JSON `.tmj` / `.tsj` / `.world`).

## Folder layout
```
src/
  main.ts                 # Phaser.Game config (480x270, pixelArt, Arcade)
  logic/                  # PURE TS: no Phaser imports (ESLint-enforced)
    state/                # GameState, PlayerState, progression, ability checks
    combat/               # damage formula, armor, material rules
    world/                # world graph, chunk coordinate math, elevation grid, gate reachability
    save/                 # serialize/deserialize, SAVE_VERSION, migrations.ts
    input/                # TankCommand type + device-independent helpers (deadzones, aim math)
    tank/                 # hull momentum, turret traverse, main-gun quick rounds, fire-rate cooldowns
  data/                   # tables: mkTiers.ts, weapons.ts, abilities.ts, enemies.ts, terrain.ts, assetManifest.ts
  game/
    placeholders.ts       # code-drawn textures for manifest entries without a file
    tiledLoader.ts        # loads .tmj + external .tsj and registers the embedded map
    scenes/               # Boot, Preload, Title, World, Hud, TouchControls, Map, Pause, Debug
    entities/             # Pawn base, Tank, Scout, Drone, Enemy types, Projectile, Pickup...
    systems/              # ChunkStreamer, ElevationSystem, CombatSystem, SpawnSystem, InputSystem, AudioSystem
    input/                # KeyboardMouseAdapter, GamepadAdapter, TouchAdapter -> TankCommand
    events.ts             # typed event bus definitions
  i18n/                   # en.json, he.json, i18n.ts (t(key, params))
public/
  assets/                 # game-ready sprites, tiles, sfx, music
  maps/<biome>/           # <biome>.world, chunk .tmj files, tilesets .tsj
assets-src/               # raw AI generations + source files (not shipped)
scripts/                  # validate-maps.ts, asset processing scripts
tests/e2e/                # Playwright specs
.github/workflows/        # ci.yml, deploy.yml
```

## Game config
- Internal resolution 480×270. `pixelArt: true` and `roundPixels: true`.
- Scaling: on resize, compute the largest **integer** zoom that fits the window and letterbox the rest. Non-integer scale is allowed only when the window is smaller than 1× (which happens on phones in portrait). If a phone is in portrait, show a "rotate device" prompt.
- Arcade physics. Tanks and pawns use **circle bodies**, because the hull's rotation is visual only; a circle body avoids rotated-AABB problems.

## Scenes and communication
- `Boot` loads the minimal assets for the loading bar. `Preload` loads the asset manifest. `Title` handles slot select, language and settings.
- `WorldScene` owns the gameplay: pawns, chunk streaming, physics, enemies. `HudScene` and `TouchControlsScene` are launched in parallel (touch only on touch devices, or when forced in settings).
- `MapScene`, `PauseScene` and `DebugScene` are overlay scenes. Opening Map or Pause pauses `WorldScene`.
- Communication: one typed event bus (`game/events.ts`, e.g. `pickup:collected`, `pawn:switched`, `hp:changed`, `radio:message`) plus the shared `GameState` instance from `src/logic/state`. Scenes never hold references to each other's game objects.

## Input
Each device adapter writes into a single `TankCommand` every frame:
```ts
interface TankCommand {
  throttle: number;      // -1..1
  turn: number;          // -1..1 (hull rotation)
  aimAngle: number | null; // world-space radians; null = keep current
  fire: boolean; altFire: boolean;
  cycleNext: boolean; cyclePrev: boolean;
  hatch: boolean; interact: boolean; map: boolean; pause: boolean;
}
```
- Keyboard/mouse: `aimAngle` is the angle from the pawn's world position to the mouse's world position.
- Gamepad/touch: `aimAngle` comes from the right stick when it's past the deadzone. Touch fires while the right stick is held past about 60% deflection.
- `fire`/`altFire` are held states. `cycleNext`/`cyclePrev`/`hatch`/`interact`/`map`/`pause` are edge-triggered: true only on the frame they're pressed.
- The mapping rules themselves (mouse buttons, stick deadzones, touch fire threshold, device selection, virtual-stick clamping) are pure functions in `logic/input/` (`mapping.ts`, `device.ts`, `virtualStick.ts`). The adapters only read devices and call them.
- Phaser quirk: its `KeyboardManager` re-dispatches the whole per-frame key queue on every DOM key event, so `keydown-*` listeners can fire more than once for one press when several key events land in a frame. `Key.JustDown` has the opposite problem: it loses a press whose down and up land in the same frame. Gameplay polls `isDown` through `RisingEdge`; one-shot toggles such as the debug keys read DOM `keydown` events and consume them once per frame.
- `InputSystem` polls every adapter each frame and uses the command from the **most recently active** device, so an idle mouse can't override the gamepad's aim. Mouse input is ignored for a moment after any touch, because browsers emulate mouse events from touches.
- Touch: `TouchControlsScene` draws two floating sticks (each appears where the thumb lands in its half of the screen) plus an alt-fire button, and writes a small shared store (`game/input/touchState.ts`) that `TouchAdapter` reads. It's launched on touch-capable devices but stays hidden until the first real touch, since many desktop browsers report touch support.
- The active pawn consumes the command. The scout and drone read throttle/turn as direct 8-way movement rather than tank controls.

## Pawns
- `Pawn` base class: `level`, circle body, health, and `applyCommand(cmd, dt)`.
- `Tank`: hull sprite plus a child turret sprite. The hull holds heading, speed and momentum. The turret rotates toward `aimAngle` at the tier's traverse rate. The Mk tier's stats and sprites are looked up from `data/mkTiers.ts`, so upgrading swaps both in place.
- The **hatch** deploys the scout (and later the drone) next to the tank's **rear**. The tank becomes stationary and vulnerable, and the camera follows the new pawn. Pressing hatch again recalls it (it walks or flies back). The scout auto-returns if it dies; there's no game over.

## Elevation
- Each chunk has an invisible `elevation` tile layer. The tile's `level` property (0–3) gives the height of that cell, and `ramp` tiles connect adjacent levels in a direction (`n|s|e|w`). A `steep: true` ramp requires `suspension`.
- `ElevationSystem` builds a per-chunk grid. A pawn moving from cell A to cell B:
  - same level → allowed (subject to normal walls/terrain)
  - different level → allowed only if A or B is a ramp oriented along the move direction; otherwise it's a cliff edge and blocks
- Entities carry `level`. Physics colliders and overlaps are filtered so that only same-level pairs interact (a process callback checks `a.level === b.level`).
- Projectiles inherit the shooter's level and are blocked by cliff edges leading to higher levels. They pass over lower cells without hitting anything down there (direct fire flies over).
- The **mortar** ignores levels while in flight (it arcs, drawn with a shadow) and resolves impact at the target cell's level.
- Rendering: depth = `level * LEVEL_DEPTH + y`. Cliff face tiles are drawn on the `walls` layer.

## Chunk streaming
- A biome is one Tiled `.world` file. Chunks are 30×17 tiles (480×272 px) named `<biome>_x<XX>_y<YY>.tmj`.
- `ChunkStreamer` computes the player's chunk coordinate each frame. When it changes, it ensures the 3×3 neighbourhood is loaded (tilemap layers, colliders, object spawns) and unloads chunks outside a 5×5 hysteresis window.
- Chunk JSON is fetched ahead of time with Phaser's loader. Tilesets are shared per biome and loaded once.
- Phaser 3 can't read external `.tsj` tilesets, so `game/tiledLoader.ts` loads the `.tmj` as JSON, then queues each referenced `.tsj`, and inlines them (`logic/world/tiled.ts`) before registering the map in the tilemap cache. A tileset's `name` is its image's asset-manifest key.
- Objects spawn from the chunk's `objects` layer when it loads. Persistent state (pickups taken, destructibles broken, switches, doors) lives in `GameState.flags` keyed by `<chunkId>:<objectId>`, so reloading a chunk respects it. Regular enemies respawn when a chunk reloads.
- The camera follows the pawn, bounded by the world's overall bounds. Chunks are marked visited in `GameState` for the map screen.

## Combat flow
Projectile hits a target → `CombatSystem` calls `logic/combat.resolveHit(weapon, target, hitAngle)` → which returns damage/effects → the entity applies them and emits events. Destructibles check `material` against the weapon or ammo rules in `data/weapons.ts`.

## Save system
- Keys: `merkavania.save.<slot>` (slots 1–3) and `merkavania.settings` (language, volume, touch-control override, keybinds).
- Shape (versioned):
```ts
{ version: SAVE_VERSION, updatedAt, playtimeMs,
  mk: 'mk2'|'mk3'|'mk4', abilities: AbilityId[], minor: {armor_plate: n, ...},
  selectedAmmo, secondaryAmmo, depotId, flags: Record<string, boolean|number>,
  visitedChunks: Record<BiomeId, string[]> }
```
- `deserialize` runs migrations in order from the stored version to the current one. Every migration has a Vitest test with a fixture of the old save.

## i18n
- `t('hud.hp')`-style keys. `en.json` is the reference and `he.json` must have the same keys (a unit test enforces this).
- Hebrew is rendered with Phaser `Text` (not BitmapText) using a pixel-style web font that includes Hebrew glyphs and `rtl: true`. Pick the font in M6 and verify its glyph coverage. The HUD layout mirrors horizontally in RTL where it makes sense.
- Radio messages are keys too (`radio.desert.intro_01`).

## Debug tools
- Enabled with `?debug=1` or in dev builds. The backtick key toggles `DebugScene` (M1 has FPS, pawn position/heading/speed, active input device and gun state; `1` toggles physics bodies). Planned:
  - show physics bodies, the elevation grid, chunk borders and the current chunk id
  - teleport (click on the map), jump to chunk, set Mk tier, grant/revoke abilities, god mode, kill all
  - FPS and loaded chunk count
- Debug hooks are exposed on `window.__merkavania` (in debug mode only) so Playwright can drive state: `game`, `getPawn()` (last-frame telemetry) and `getShots()` (shots per weapon id).

## Testing
- **Work test-first** (see `CLAUDE.md`, Workflow). Game code stays a thin shell over tested `src/logic/` functions.
- **Vitest:** everything in `src/logic/` and `scripts/` (tank handling, input mapping, damage, progression, save migrations, elevation traversal rules, gate reachability, i18n key parity), sanity tests for the `src/data/` tables (ids and asset keys resolve, values in range) and structural tests for hand-built maps.
- **Playwright** (`tests/e2e/`, shared helpers in `helpers.ts`): boot the game and confirm the title and then `WorldScene` load with no console errors. Behaviour that only exists in a running scene (collisions, turret traverse, fire cadence, the gamepad via a stubbed `navigator.getGamepads`, touch via CDP multi-touch, debug overlay keys) is checked through `window.__merkavania` hooks. Later: grant abilities and test a gate.
- **Map validation:** `npm run validate:maps` (see `LEVEL_DESIGN.md`).

## Deploy
- `ci.yml` runs `npm ci && npm run check && npm run test:e2e` on PRs.
- `deploy.yml` runs on pushes to `main`: it builds with `VITE_BASE=/merkavania/` (Vite `base` reads this; the default is `/`) and publishes `dist/` with `actions/deploy-pages`.
