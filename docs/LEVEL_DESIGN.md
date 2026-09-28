# Merkavania: Level Design (Tiled conventions)

The map validator (`npm run validate:maps`) enforces everything here. Ids must match `src/data/` and `GAME_DESIGN.md`.

## Files
- One folder per biome: `public/maps/<biome>/`
  - `<biome>.world`: a Tiled world file listing every chunk and its pixel offset
  - `<biome>_x<XX>_y<YY>.tmj`: chunk maps, JSON format, zero-padded coordinates
  - `*.tsj`: external tilesets in JSON (never embedded in maps)
- Chunk size is fixed at **30×17 tiles** of 16px (480×272). World offsets must be multiples of the chunk size.
- Chunks that connect across biomes use an `exit` object pointing to the target biome, chunk and spawn.

## Layers (per chunk, in this order)
| Layer | Type | Purpose |
|---|---|---|
| `ground` | tile | Base terrain; tiles carry a `terrain` property |
| `elevation` | tile (invisible) | Height data: `level` and `ramp`/`steep` properties |
| `walls` | tile | Solid tiles and cliff faces (tile property `solid: true`) |
| `decor` | tile | Non-colliding detail below entities |
| `above` | tile | Drawn above entities (tree canopies, bridges, overhangs) |
| `objects` | object | Everything interactive (see below) |

## Tile properties
| Property | Values | Meaning |
|---|---|---|
| `terrain` | `sand`, `rock`, `road`, `water_shallow`, `water_deep`, `mud`, `rubble`, `minefield`, `crawlspace`, `chasm`, `missile_zone` | Movement rules / gates |
| `level` | `0`–`3` | Elevation of the cell (on `elevation` layer) |
| `ramp` | `n`, `s`, `e`, `w` | Direction you travel to go **up** the ramp |
| `steep` | `true` | Ramp needs `suspension` (Mk3+) |
| `solid` | `true` | Blocks movement and direct fire |

Terrain → requirement mapping (defined in `data/terrain.ts`):
`water_deep`→`snorkel`, `mud`→`wide_tracks`, `rubble`→`dozer_blade` (clears it), `minefield`→`mine_plow`, `crawlspace`→scout only, `chasm`→drone only, `missile_zone`→`trophy` (otherwise heavy damage over time).

## Object types (`objects` layer; the Tiled object *class/type* is the id)
| Type | Properties | Notes |
|---|---|---|
| `spawn` | `name` | Named entry point; `start` is the new-game spawn |
| `exit` | `toBiome`, `toChunk`, `toSpawn` | Cross-biome transition |
| `depot` | `id` | Repair/save station |
| `pickup` | `ability` or `minor`, `id` | Persistent once collected |
| `mk_upgrade` | `tier` | Usually spawned by the boss's death |
| `enemy` | `enemyType`, `level`, optional `patrol` (polyline name) | |
| `boss` | `bossType`, `arena` (rect name) | |
| `destructible` | `material`: `sandbag`/`wood`/`concrete`/`armored`, `id` | Persistent |
| `boulder` | `id` | Pushable with `dozer_blade` |
| `switch` | `id`, `activatedBy`: `cannon`/`mortar`/`scout`/`drone`/`lahat`/`remote` | Persistent |
| `door` | `id`, `opensWith` (switch id) | |
| `zone` | `kind`: `sensor`/`boss_arena`/`radio_trigger`, props per kind | Rect objects |
| `radio` | `messageKey`, `once` (default true) | Point or rect trigger |

Every object that has persistent state needs an `id` that is unique within its chunk. The save key is `<chunkId>:<id>`.

## Design rules
- **Telegraph gates:** every gate type has a distinct tile or sprite (cracked concrete, a mine sign, a deep-water colour), and the player should see one before getting the ability for it.
- **Depots:** a depot within about 4 chunks of travel of any point, and one before every boss.
- **No soft-locks:** the player must never be able to reach a spot they can't leave with their current abilities. One-way drops are allowed only if the area below has another way out.
- Keep the chunk edges that line up between neighbours consistent: matching elevation levels and matching walls.
- Leave space for a 32px tank to turn. Corridors should be at least 3 tiles wide for the tank, and 1 tile wide for `crawlspace`.

## What `validate:maps` checks
1. Every chunk listed in a `.world` exists, is 30×17, and has the required layers in order.
2. All tilesets are external `.tsj`, and every `terrain`/`level`/`ramp` value is known.
3. Every object type and its properties are known (ability, enemy, material and message ids exist in `src/data/` and `src/i18n/en.json`).
4. Persistent object ids are unique per chunk, door `opensWith` points to an existing switch, and exits point to existing chunks and spawns.
5. Every chunk has consistent elevation on its edges with neighbouring chunks.
6. **Progression reachability:** starting at `start` with Mk2 and no abilities, it simulates collecting pickups in dependency order through a coarse chunk/region graph (built by `src/logic/world`). It confirms every pickup, depot and boss is eventually reachable and no required ability is locked behind itself.

Failures print `<file>:<layer>:<object>` plus a reason. The command exits non-zero, which fails CI.
