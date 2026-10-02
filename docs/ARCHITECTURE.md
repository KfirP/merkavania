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
    state/                # GameState (gameState.ts: pickups, secondaries, depots, max HP), WorldFlags
    combat/               # damage formula, armor, material rules, factions, hazards, splash, missile guidance
    enemy/                # enemy brain (state machine), vehicle steering, getting unstuck
    world/                # chunk coordinate math, elevation grid, objects, switches, map validation and reachability
    save/                 # serialize/deserialize, SAVE_VERSION, migrations.ts
    input/                # TankCommand type + device-independent helpers (deadzones, aim math)
    tank/                 # hull momentum, turret traverse, main-gun quick rounds, fire-rate cooldowns
  data/                   # tables: mkTiers.ts, weapons.ts, combat.ts, materials.ts, abilities.ts, enemies.ts, terrain.ts, assetManifest.ts
  game/
    placeholders.ts       # code-drawn textures for manifest entries without a file
    tiledLoader.ts        # loads .tmj + external .tsj and registers the embedded map
    scenes/               # Boot, Preload, Title, World, Hud, TouchControls, Map, Pause, Debug
    entities/             # Pawn base, Tank, Scout, Drone, Enemy, Destructible, Projectile, Pickup...
    systems/              # ChunkStreamer, ElevationSystem, CombatSystem, SpawnSystem, EffectsSystem, ProjectileSystem, MortarSystem, ProgressionSystem, InputSystem, AudioSystem
    input/                # KeyboardMouseAdapter, GamepadAdapter, TouchAdapter -> TankCommand
    events.ts             # typed event bus definitions
  i18n/                   # en.json, he.json, i18n.ts (t(key, params))
public/
  assets/                 # game-ready sprites, tiles, sfx, music
  maps/<biome>/           # <biome>.world, chunk .tmj files, tilesets .tsj
assets-src/               # raw AI generations + source files (not shipped)
scripts/                  # validate-maps.ts, process-sprites.ts (+ pure bitmap ops in sprites.ts)
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
- Communication: one typed event bus (`game/events.ts`, e.g. `pickup:collected`, `depot:used`, `loadout:changed`, `hp:changed`) plus the shared `GameState` instance from `src/logic/state`. Scenes never hold references to each other's game objects. Overlay scenes start after WorldScene's first emits, so they read the current value with `events.latest(name)` and then follow the event.

## Input
Each device adapter writes into a single `TankCommand` every frame:
```ts
interface TankCommand {
  throttle: number;      // -1..1
  turn: number;          // -1..1 (hull rotation)
  aimAngle: number | null; // world-space radians; null = keep current
  aimDistance: number | null; // px to the aimed spot (mortar range); null = keep the last one
  lob: { angle: number; distance: number } | null; // one-shot mortar fire (touch mortar button)
  fire: boolean; altFire: boolean; // altFire = the selected secondary
  altCoax: boolean; // alt fire is the coax whatever is selected (touch MG mode)
  cycleNext: boolean; cyclePrev: boolean;
  hatch: boolean; interact: boolean; map: boolean; pause: boolean;
}
```
- Keyboard/mouse: `aimAngle` is the angle from the pawn's world position to the mouse's world position, and `aimDistance` the distance to it.
- Gamepad/touch: `aimAngle` comes from the right stick when it's past the deadzone. On the gamepad, the stick's tilt past the deadzone maps onto the mortar's min..max range (`padLobDistance`).
- Touch mortar button (`logic/input/touchLob.ts`): shown once the tank has the mortar. Drag from it to a spot and lift to lob a shell there; a tap or dragging back onto the button fires nothing. `TouchAdapter` turns the lifted screen point into a world angle and distance (`cmd.lob`).
- Touch right stick (`logic/input/touchAim.ts`): dragging past the deadzone aims and arms the cannon, and lifting fires it. Dragging back inside the deadzone first cancels, and a tap never fires. The aim is sticky, so the turret finishes its swing after the thumb lifts. The released shot waits until the turret lines up, clears when the gun fires, and is dropped if the gun can't fire within a short window (e.g. during a quick-round refill). The ALT button toggles MG mode, which switches the stick from the cannon to the coax. The stick's outer ring then fires the MG while held, and lifting never fires the cannon. The knob is grey in the cancel zone, orange when a lift would fire and yellow while the MG fires.
- `fire`/`altFire` are held states. `cycleNext`/`cyclePrev`/`hatch`/`interact`/`map`/`pause` are edge-triggered: true only on the frame they're pressed.
- The mapping rules themselves (mouse buttons, stick deadzones, touch aim/fire, device selection, virtual-stick clamping) are pure functions in `logic/input/` (`mapping.ts`, `touchAim.ts`, `device.ts`, `virtualStick.ts`). The adapters only read devices and call them.
- Phaser quirk: its `KeyboardManager` re-dispatches the whole per-frame key queue on every DOM key event, so `keydown-*` listeners can fire more than once for one press when several key events land in a frame. `Key.JustDown` has the opposite problem: it loses a press whose down and up land in the same frame. Gameplay polls `isDown` through `RisingEdge`; one-shot toggles such as the debug keys read DOM `keydown` events and consume them once per frame.
- `InputSystem` polls every adapter each frame and uses the command from the **most recently active** device, so an idle mouse can't override the gamepad's aim. Mouse input is ignored for a moment after any touch, because browsers emulate mouse events from touches.
- Touch: `TouchControlsScene` draws two floating sticks (each appears where the thumb lands in its half of the screen) plus the ALT (MG mode) toggle, and writes a small shared store (`game/input/touchState.ts`) that `TouchAdapter` reads. It's launched on touch-capable devices but stays hidden until the first real touch, since many desktop browsers report touch support.
- The active pawn consumes the command. The scout and drone read throttle/turn as direct 8-way movement rather than tank controls.

## Pawns
- `Pawn` base class: `level`, circle body, health, and `applyCommand(cmd, dt)`.
- `Tank`: hull sprite plus a child turret sprite. The hull holds heading, speed and momentum. The turret rotates toward `aimAngle` at the tier's traverse rate. The Mk tier's stats and sprites are looked up from `data/mkTiers.ts`, so upgrading swaps both in place.
- `Scout` (`data/pawns.ts`): a small circle body that walks 8-way (`logic/pawn/scoutMove.scoutVelocity`), faces its aim and fires the `rifle_scout` (small arms). It fits through `crawlspace`, takes pickups, flips `scout` switches by walking onto them (`logic/world/switches.pawnActivates`), and is stopped by walls, doors, destructibles, boulders and enemies on its level. Hazard terrain hurts it; depots ignore it.
- `PawnSystem` owns the tank, the scout while it's out and the hatch state (`logic/pawn/hatch.ts`). `active` is the pawn that takes input and that the camera, chunk streaming and `getPawn()` follow; `players` is what enemies may target. The scout lives in a physics group, so its colliders are made once and survive deploys.
- The **hatch** deploys the scout (and later the drone) just behind the tank's **rear** (`deployPoint`). It opens only with `hatch_scout`, a living tank slower than `deploySpeedMax`, no cooldown, and a free spot: on the tank's level, walkable for the scout from under the tank, and clear of doors, destructibles and boulders. A refusal for being blocked or moving shows a HUD toast (`hatch:refused`). While the scout is out the tank gets empty commands, so it holds still and can still be hit.
- The scout stays on a **leash** (`data/pawns.ts`, `leash` < a chunk width) around the tank, so the tank's chunk never streams out. At the end of the leash the outward part of its motion is dropped (`limitToLeash`).
- **Boarding:** walking back within `boardRadius` of the tank boards it, once the scout has first walked clear (so it doesn't climb straight back in). Pressing hatch again **recalls** it: `logic/world/path.findPath` (a BFS under the movement rules, closed doors solid) gives a route of tile centres it walks at `recallSpeed`, ignoring input. With no route, or one that stalls, it fades out and is back inside.
- If the scout dies, control snaps back to the tank and the hatch stays shut for `deathCooldown`. If the tank dies, the scout is dropped. There's no game over for the scout, and it's never saved.
- Events: `pawn:switched` (the HUD's HP bar follows the active pawn), `hatch:refused`, `scout:died`, and `abilities:changed` (the touch hatch button shows once the tank has `hatch_scout`).

## Elevation
- Each chunk has an invisible `elevation` tile layer (tiles from the shared `maps/shared/elevation.tsj`). The tile's `level` property (0–3) gives the height of that cell; an empty cell is level 0. `ramp` tiles connect adjacent levels in a direction (`n|s|e|w`). A ramp's `level` is its **low** end, and travelling in its `ramp` direction climbs exactly one level. A `steep: true` ramp requires `suspension`.
- `logic/world/grid.ts` parses each loaded chunk into cells (`level`, `ramp`, `steep`, `terrain` from `ground`, `solid` from `walls`), and `WorldGrid` looks them up by world tile. The rules are in `logic/world/traversal.ts`. A pawn moving from cell A to cell B:
  - same level → allowed (subject to solid tiles and terrain gates)
  - a difference of one level → allowed only if the lower cell is a ramp pointing toward the higher one (and, if steep, the pawn has `suspension`)
  - anything else → a cliff edge, which blocks
- `ElevationSystem` works on any `Mover` (kind, level, speedMul, body, pos): the active pawn with the player's abilities, and enemies with none (vehicles use the tank's terrain rules, soldiers the scout's).
- `constrainMove` sweeps the circle body's leading edge axis by axis, so a blocked axis stops while the other keeps sliding. The body may never straddle a cliff, so a ramp must be wider than the pawn. `ElevationSystem` applies it to the pawn's **body**: Arcade steps bodies before the scene's `update` and copies the result to the sprite only in `postUpdate`, so the sprite is a step behind during `update`. Any gameplay code running in `update` (aim origin, muzzle position, depth, streaming, telemetry) reads the pawn's position through `Pawn.pos` (the body centre), never `x`/`y`. A blocked axis snaps the body to the boundary and zeroes that velocity, and the tank bleeds momentum as it does against walls.
- A pawn's `level` is the level of the cell under its centre. Entities carry `level`. Physics colliders and overlaps between entities are filtered so that only same-level pairs interact (a process callback checks `a.level === b.level`): tank and enemies, tank and destructibles, enemies with each other and with destructibles, and projectiles through `canHit`.
- Projectiles inherit the shooter's level. They expire when they enter a cell higher than their level, and walls only stop them on the wall's level or above. They pass over lower cells without hitting anything down there (direct fire flies over).
- The **mortar** (`MortarSystem`, math in `logic/combat/mortar.ts`) ignores levels and walls while in flight (an arc drawn above everything, with a shadow on the ground) and explodes on the level of the cell it lands on, clamped to the weapon's `lob.minRange`..`range`. It fires from its own mount toward the aim, not along the turret.
- Rendering: depth = `level * LEVEL_DEPTH + y`. Cliff face tiles are drawn on the `walls` layer.

## Chunk streaming
- A biome is one Tiled `.world` file. Chunks are 30×17 tiles (480×272 px) named `<biome>_x<XX>_y<YY>.tmj`.
- `ChunkStreamer` computes the player's chunk coordinate each frame. When it changes, it ensures the 3×3 neighbourhood is loaded (tilemap layers, colliders, object spawns) and unloads chunks outside a 5×5 hysteresis window. The window math is in `logic/world/chunks.ts`, and it emits `world:chunks` on the event bus.
- Chunk JSON is fetched ahead of time with Phaser's loader (`queueTiledWorld` queues the `.world` and then every chunk), so loading a chunk is synchronous. Tilesets are cached by path, so they're loaded once and shared.
- Terrain (`data/terrain.ts`) gives each terrain id a top-speed multiplier and an optional gate: a required ability (without it the terrain either blocks or is a `hazard` that deals `hazardDps`) or the pawns allowed on it.
- Phaser 3 can't read external `.tsj` tilesets, so `game/tiledLoader.ts` loads the `.tmj` as JSON, then queues each referenced `.tsj`, and inlines them (`logic/world/tiled.ts`) before registering the map in the tilemap cache. A tileset's `name` is its image's asset-manifest key.
- Objects spawn from the chunk's `objects` layer when it loads: `ChunkStreamer` calls `SpawnSystem.onLoad`/`onUnload`, which parse them with `logic/world/objects.ts`. Persistent state (pickups taken, destructibles broken, switches flipped) lives in the GameState's flags keyed by `<chunkId>:<objectId>` (`logic/state/flags.ts`), so reloading a chunk respects it; a door stays open once its switch's flag is set. Regular enemies respawn when a chunk reloads and when the player respawns, and boulders go back to their spot when their chunk reloads.
- The camera follows the pawn, bounded by the world's overall bounds. Chunks are marked visited in `GameState` for the map screen.

## Progression
- `ProgressionSystem` owns the `GameState` and its save slot. The rules are pure functions in `logic/state/gameState.ts`: `collectPickup` (idempotent by flag; abilities, `armor_plate` max HP, `ammo_rack` capacity), `cycleSecondary` (skips locked ones), `spendAmmo`, `useDepot` (respawn point + refill), `maxHp`. Numbers are in `data/progression.ts`.
- A pickup is taken when the tank overlaps it on its level, and the game saves right away. Rolling onto a depot pad heals, rearms and saves, once per visit. The tank respawns at the last depot (`findDepot`), or at `start`.
- `ElevationSystem` reads the GameState's abilities, so `dozer_blade` opens rubble. Boulders are immovable bodies that only a tank with the dozer blade shoves (`Boulder.shove`); one that's jammed against a cliff, wall, door or another boulder blocks the blade.
- Switches are `Trigger`s, not `Damageable`s: `CombatSystem` tells them about every direct hit and every blast in reach on their level, and `logic/world/switches.activates` decides whether that weapon flips them. A flipped switch sets its flag and opens the doors whose `opensWith` names it. Doors are static bodies in their own group: they block the tank and enemies on their level and stop fire like walls do.

## Combat flow
- Everything hittable implements `Damageable` (`combatId`, `faction`, `level`, `hp`, `defense`, `die()`): the tank (`player`), enemies (`enemy`) and destructibles (`neutral`). `Projectile`s carry their `weapon` and `owner`.
- `CombatSystem.watch()` adds an Arcade overlap between the projectile pool and a target or a physics group of targets. Arcade can't overlap a plain `Group` (it has no collision category), and it swaps the callback pair for a group against a single sprite, so the pair is sorted by type. The process callback is `logic/combat/faction.canHit`: the other side, on the same level.
- A hit resolves in `logic/combat/damage.ts`. Armored targets use `resolveHit`: weapon damage × `armorMultipliers[armor][weapon.class]` (`data/combat.ts`), ×1.5 when the shot arrives inside the ±45° rear arc of a target that has a hull `heading`. Destructibles use `damageMaterial`: full damage at or above their `minAmmo` (`standard` < `heat` < `apfsds`), none below. A low multiplier or a material the ammo can't break is a **ricochet** (sparks instead of a flash).
- `logic/combat/health.applyDamage` updates HP; `hp:changed` and `combat:hit` go out, and the entity's `die()` runs on the killing hit. Splash weapons (`weapon.splash`) then damage everything else in range on that level with linear falloff (`logic/combat/splash.ts`); hits on walls and cliffs splash too.
- Hazard terrain and debug damage go through `CombatSystem.damage` (no armor). A moving tank crushes soldiers on contact (`logic/combat/crush.ts`).
- Splash damage lives in `CombatSystem.explode(blast)`, which projectile impacts and landing mortar shells share.
- Player death: the tank hides and stops colliding, the camera fades, and after `RESPAWN_DELAY` it respawns at the last depot used (or `start`) with full HP. Enemies reset on `player:respawned`.
- `EffectsSystem` owns the short-lived feedback: impact puffs, explosions scaled to the splash radius, ricochet sparks, white hit flashes, missile smoke trails, and camera shake from `logic/combat/shake.ts` (player hits scale with damage; explosions fade with distance from the camera).

## Enemies
- `data/enemies.ts` holds every number: HP, armor, rear arc, behaviour, squad size, speeds, weapon, sight and fire range, windup and death blast. Behaviours: `infantry`, `raider`, `armor`, `static`, `missile_team`.
- `logic/enemy/brain.ts` is a pure state machine: `idle` (patrol the Tiled polyline, or return home) → `alert` (aim for `windup` seconds, the telegraph; the ATGM team shows a blinking laser) → `engage` (fire when aimed, in range and cooled down; move per behaviour: infantry scatter from a close tank, raiders orbit, armor closes to range and holds, static never moves) → `search` (hunt the last known spot for a few seconds) → `idle`.
- Target: each enemy goes after the closest player pawn it can see (the tank, or the scout while it's out), else the closest living one, unseen (`logic/enemy/target.pickTarget`).
- Perception: `visible` means the player is alive, on the same level, within sight range and in line of sight by `logic/world/lineOfSight.ts`, which follows the direct-fire rules, so enemies see exactly what they can shoot.
- `game/entities/Enemy.ts` carries out the intent. Vehicles drive `logic/tank/hull.stepHull` through `logic/enemy/steer.ts`, bleed momentum on impact like the tank, and back off walls with `logic/enemy/unstick.ts`. Soldiers walk straight. Static guns only traverse within `aimArc` of their facing (the Tiled object rotation).
- ATGMs home in on the closest living player pawn: `ProjectileSystem` steers them each frame with `logic/combat/guidance.steerMissile` at the weapon's `homing` turn rate. They're slower than the tank on a road, so they can be outrun, out-turned or blocked by walls.
- Damaged enemies show a small HP bar for a few seconds; the tank's HP bar lives in `HudScene`.

## Save system
- Keys: `merkavania.save.<slot>` (slots 1–3) and `merkavania.settings` (language, volume, touch-control override, keybinds; M6). The game uses slot 1, or `?slot=N`, until M6 adds slot select.
- Shape (`logic/save/save.ts`, `SAVE_VERSION` 1):
```ts
{ version: SAVE_VERSION, updatedAt, playtimeMs,
  mk: 'mk2'|'mk3'|'mk4', abilities: AbilityId[], minor: {armor_plate: n, ammo_rack: n, repair_kit: n},
  selectedSecondary, secondaryAmmo: {mortar: n}, depotId, flags: Record<string, boolean|number>,
  visitedChunks: Record<BiomeId, string[]> }
```
- `deserialize` runs migrations (`logic/save/migrations.ts`, `migrations[n]` turns version n into n+1) in order from the stored version to the current one, then validates. Unreadable, corrupt or newer saves load as an empty slot; unknown ability or secondary ids are dropped instead of failing the whole save. Every migration has a Vitest test with a fixture of the old save.
- `SaveStore` wraps a `Storage`-like object and swallows storage errors; where localStorage is blocked the game keeps an in-memory store for the session.

## i18n
- `t('hud.hp')`-style keys. `en.json` is the reference and `he.json` must have the same keys (a unit test enforces this).
- Hebrew is rendered with Phaser `Text` (not BitmapText) using a pixel-style web font that includes Hebrew glyphs and `rtl: true`. Pick the font in M6 and verify its glyph coverage. The HUD layout mirrors horizontally in RTL where it makes sense.
- Radio messages are keys too (`radio.desert.intro_01`).

## Debug tools
- Enabled with `?debug=1` or in dev builds. The backtick key toggles `DebugScene`: FPS, pawn position/heading/speed, active input device, gun state, and the current chunk, pawn level and loaded chunk count. `1` toggles physics bodies, and `2` toggles the elevation overlay (levels tinted, ramps cyan, steep ramps red, chunk borders magenta). Planned:
  - teleport by clicking on the map, jump to chunk, set Mk tier, grant/revoke abilities, kill all
- Debug hooks are exposed on `window.__merkavania` (in debug mode only) so Playwright can drive state: `game`, `getPawn()` (last-frame telemetry of the active pawn, including `kind`, `level`, `chunk`, `hp`, `maxHp` and `alive`), `getTank()` (the tank's, whichever pawn is active), `pressHatch()`, `damageScout(n)`, `getShots()` (the player's shots per weapon id), `getWorld()` (current and loaded chunk ids), `teleport(x, y, heading?)` (moves the active pawn; the scout's leash still applies), `worldToCanvas(x, y)` (so specs aim with the real mouse), `damagePlayer(n)`, `setGod(on)`, `getCombatLog()` (recent resolved hits), `getDestructibles()`, `getEnemies()`, `spawnEnemy(type, x, y, facing?)`, `getState()` (the GameState in save shape), `grantAbility(id)`, `getSave(slot)`, `clearSave(slot)`, `getObjects()` (pickups, switches, doors, depots and boulders in loaded chunks) and `getMortarLandings()`.

## Testing
- **Work test-first** (see `CLAUDE.md`, Workflow). Game code stays a thin shell over tested `src/logic/` functions.
- **Vitest:** everything in `src/logic/` and `scripts/` (tank handling, input mapping, damage, progression, save migrations, elevation traversal rules, gate reachability, i18n key parity), sanity tests for the `src/data/` tables (ids and asset keys resolve, values in range) and structural tests for hand-built maps.
- **Playwright** (`tests/e2e/`, shared helpers in `helpers.ts`): boot the game and confirm the title and then `WorldScene` load with no console errors. Behaviour that only exists in a running scene (collisions, turret traverse, fire cadence, combat and enemies in `combat.spec.ts`, pickups, gates, depots and saves in `progression.spec.ts`, the rear hatch and scout in `hatch.spec.ts`, the gamepad via a stubbed `navigator.getGamepads`, touch via CDP multi-touch, debug overlay keys) is checked through `window.__merkavania` hooks. Input is polled once per frame, so specs hold keys and mouse buttons for a few frames rather than tapping them.
- **Map validation:** `npm run validate:maps` (see `LEVEL_DESIGN.md`).

## Deploy
- `ci.yml` runs `npm ci && npm run check && npm run test:e2e` on PRs.
- `deploy.yml` runs on pushes to `main`: it builds with `VITE_BASE=/merkavania/` (Vite `base` reads this; the default is `/`) and publishes `dist/` with `actions/deploy-pages`.
