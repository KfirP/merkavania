# Merkavania: Game Design

> **Draft.** This came out of the initial design interview. Edit it freely; the ids in `code` format are the canonical identifiers used in `src/data/` and in Tiled maps.

## Pitch
A top-down pixel-art metroidvania. You command a lone Merkava tank that has been cut off behind a collapsing front. What starts as a grounded military operation in a desert outpost gets steadily stranger: abandoned research sites, experimental weapons, and something underground that the war was really about. You upgrade the tank from **Mk2 → Mk3 → Mk4** and collect equipment that opens up an interconnected world.
The game should have humorous feel to it, this is not a serious game by any means.

## Pillars
1. **The tank is the character.** It has weight, momentum and a hull that turns. The turret and hull move independently. Every upgrade makes the tank visibly and mechanically different.
2. **Every upgrade is a key.** Each major pickup opens new routes (terrain, walls, elevation, tiny passages), and old areas become worth revisiting.
3. **Grounded first, weird later.** Military realism sets the tone, and the sci-fi creeps in: bosses, late biomes, lore.
4. **Readable pixel art.** 16px grid and a clear silhouette for every gate type. The player should recognise a gate before owning the ability for it.

## Controls
The same actions are available on every input device, and all of them feed into one `TankCommand`.

| Action | Keyboard + mouse | Gamepad | Touch |
|---|---|---|---|
| Throttle fwd/back | W / S | Left stick Y | Left virtual stick Y |
| Rotate hull | A / D | Left stick X | Left virtual stick X |
| Aim turret | Mouse position | Right stick | Right virtual stick |
| Fire main gun | Right click | RT | Right stick: drag to aim, lift to fire (drag back to the centre first to cancel) |
| Alt fire: the selected secondary (coax MG / mortar / missile) | Left click (the mortar lands at the cursor) | LT (right-stick tilt sets the mortar range) | Alt button toggles MG mode, which switches the right stick from the cannon to the coax: it fires while dragged past its outer ring, and lifting never fires the cannon. The mortar has its own button (shown once you have it): drag from it to a spot and lift to fire there; drag back onto it to cancel. The missile will need its own gesture too |
| Cycle ammo / secondary | Q / E, wheel | LB / RB | Swap button (M6) |
| Rear hatch (deploy/recall pawn) | F | Y | Hatch button |
| Interact | Space | A | Context button (appears when relevant) |
| Map | M / Tab | Select | Map button |
| Pause | Esc | Start | Pause button |

The turret turns toward its aim angle at a limited **traverse rate** that depends on the Mk tier. The hull has acceleration, top speed and turn rate. It drives forward and back along its heading and never strafes.

## Tank tiers (major milestones)
Each Mk upgrade brings a new hull and turret sprite, more HP and armor, a new main gun, and one **signature ability** that opens a gate type.
Each Mk has a number of "quick cannon rounds", to refill quick rounds, theres a 3*(quick rounds count) seconds timer which starts when quick rounds reaches to 0. The tank can't shoot during quick round refill.

| Tier | Main gun | Stats (relative) | Signature ability | Gate opened |
|---|---|---|---|---|
| `mk2` (start) | 105mm | HP 100, armor low, fast turn, low fire rate, 6 quick rounds| none (starts with the coax MG and the 60mm mortar mount, which stays empty until `mortar` is found) | n/a |
| `mk3` | 120mm (can fire APFSDS once found), mid fire rate, 5 quick rounds | HP 160, armor med | `suspension`: improved suspension | `steep_ramp` (steep ramps to higher plateaus) |
| `mk4` | 120mm, improved fire control (faster traverse, better projectile speed, fast cannon fire rate, 10 quick rounds) | HP 240, armor high | `trophy`: Trophy active protection | `missile_zone` (areas saturated with ATGM fire) |

Mk upgrades are fixed story moments (boss rewards), never optional pickups.

## Abilities & gates
Each ability except the Mk signatures is a pickup found in the world. There is no currency and no shop.

| Ability id | What it is | Gate / use | First biome |
|---|---|---|---|
| `mortar` | 60mm mortar (alt fire, arcing shot) | Hits targets on other elevation levels or behind walls: `mortar` switches, entrenched enemies | Desert |
| `hatch_scout` | Rear hatch: deploy infantry scout | The scout fits through `crawlspace` tiles, flips `scout` switches by walking onto them and grabs pickups the tank can't reach; you recall the scout or walk it back to the tank | Desert |
| `dozer_blade` | Front dozer blade | Clears `rubble` terrain and pushes `boulder` objects | Desert |
| `ammo_heat` | HEAT rounds | Destroys `concrete` destructibles | Hills |
| `snorkel` | Deep-fording kit | Drive through `water_deep` | Hills |
| `ammo_apfsds` | APFSDS rounds (needs Mk3 gun) | Destroys `armored` destructibles, pierces shielded enemies | Coastal city |
| `mine_plow` | Mine plow | Safely crosses `minefield` terrain | Coastal city |
| `smoke` | Smoke launchers | Temporarily hides the tank from `sensor` zones (sensor-locked doors stay open) | Coastal city |
| `wide_tracks` | Wide tracks | Drive through `mud` without getting stuck | Underground |
| `lahat` | LAHAT gun-launched guided missile | Steered around corners to hit `remote` switches | Underground |
| `hatch_drone` | Hatch upgrade: recon drone | Flies over `chasm` tiles and walls on its own level; triggers `drone` switches | Underground |
| `suspension` | Mk3 signature | `steep_ramp` | End of Desert |
| `trophy` | Mk4 signature | `missile_zone` | End of Underground |

Minor pickups (also found in the world, never bought):
- `armor_plate`: +max HP
- `ammo_rack`: +secondary ammo capacity
- `repair_kit`: +1 field repair charge

Sequence breaks: the design tolerates skilled players reaching areas early (for example, mortar-hitting a switch from an odd angle) as long as the progression graph can't **soft-lock**. The map validator checks this (see `LEVEL_DESIGN.md`).

## Combat & damage
- Damage = weapon damage × material/armor modifier. The tank's armor tier reduces incoming damage, and a hit to the **rear arc** does +50%. This rewards keeping the front toward the enemy, a Merkava theme.
- Armor ids (`data/combat.ts`): `none` (infantry), `light` (technical), `low` (Mk2, light tank), `med`, `high`, `fortified` (bunkers). Each gives a damage multiplier per weapon class (`small_arms`, `cannon`, `missile`): the coax MG barely scratches armor and ricochets, while cannons and missiles get through.
- Destructible materials: `sandbag` (any weapon), `wood` (any weapon), `concrete` (HEAT+), `armored` (APFSDS). Each has a `minAmmo`; standard shells bounce off anything tougher.
- Splash: main-gun shells, the light tank's gun and ATGMs explode, hurting everything nearby on the same level.
- Hazards: a `minefield` or `missile_zone` without its ability deals damage every second.
- The tank flattens soldiers it drives into. It is a tank.
- Secondary weapons use limited ammo that refills at depots. The main gun and coax MG have unlimited ammo, with a reload time for the main gun.
- **Death:** respawn at the last depot you used (the `start` spawn before the first one). Pickups you collected are kept (they're saved when collected); enemies respawn.

## The rear hatch scout
- With `hatch_scout`, stop the tank and press hatch: a scout climbs out of the rear door (very Merkava). The tank waits where it is, still in the fight, and the camera follows the scout.
- The scout walks in 8 directions, fits through `crawlspace`, and carries a light rifle that drops infantry and breaks sandbags and wood but bounces off armor. It's fragile (30 HP).
- It flips `scout` switches by walking onto them and can pick up anything it reaches.
- It stays within radio range of the tank (a leash of about 400px). Walk it back into the tank to board, or press hatch to recall it, and it jogs home on its own.
- If it goes down, you're back in the tank (no game over) and the hatch stays shut for a moment.

## Save & depots
- **Repair depots** (`depot` objects) heal fully, refill secondary ammo and save the game when you drive onto the pad (once per visit).
- There are 3 save slots.
- The 60mm mortar holds 6 rounds (+2 per `ammo_rack`); each `armor_plate` adds 20 max HP (`data/progression.ts`).
- The map screen shows the chunks you've explored, depots, and any collected or seen pickup markers.

## Enemies (mostly military)
Desert enemies (numbers in `data/enemies.ts`): `rifle_squad` (three soldiers who scatter from a close tank), `technical` (fast, circles you with an MG), `bunker_mg` (fortified, only traverses its front arc, weak from behind), `atgm_team` (aims a blinking laser for a long moment, then fires a slow guided missile you can outrun, out-turn or hide from), `light_tank` (closes to range, weak rear arc). Each spots you only on your level and in line of sight, telegraphs before its first shot, and hunts your last known position when it loses you.

| Biome | Enemies |
|---|---|
| Desert | `rifle_squad`, `atgm_team` (slow guided missile), `technical` (fast pickup + MG), `bunker_mg`, `light_tank` |
| Hills | `mortar_team`, `apc`, `sniper_nest`, `mbt` (main battle tank) |
| Coastal city | `rpg_team` (in buildings), `spg` (artillery, off-screen shells with warning markers), `helicopter` |
| Underground | `security_turret`, `sentry_drone`, `prototype_walker` (sci-fi) |
| Sci-fi core | Experimental versions of the above plus `anomaly` hazards |

Bosses (one per biome): `boss_desert` is a fortified command bunker with a rail-mounted gun; the later bosses escalate into sci-fi (a prototype heavy tank, a walker, a core guardian).

## Biomes (full game)
1. **Desert outpost / ruined base** (`desert`): sand, bunkers, wrecked vehicles. Pickups: `mortar`, `hatch_scout`, `dozer_blade`. The boss grants **Mk3** (`suspension`).
2. **Northern hills** (`hills`): rocky ridges, pines, streams, lots of elevation. `ammo_heat`, `snorkel`.
3. **Coastal city ruins** (`city`): dense streets, minefields, sensors. `ammo_apfsds`, `mine_plow`, `smoke`.
4. **Underground research complex** (`underground`): labs, mud caverns, chasms. `wide_tracks`, `lahat`, `hatch_drone`. The boss grants **Mk4** (`trophy`).
5. **Sci-fi core** (`core`): the finale, which uses every gate type.

Biomes connect in more than one place so players backtrack and take shortcuts.

## Narrative
- Light. **Radio transmissions** (`radio` objects in maps, or scripted triggers) show short portrait-less messages from Command and, later, from stranger voices. Each is 1–3 lines.
- Environmental lore: wrecks, signs, terminals the scout can read.
- There are no cutscenes beyond short camera pans for boss intros and Mk upgrades.

## Vertical slice (first playable target)
- Biome: `desert` only, about 15–20 chunks.
- The player starts in a Mk2 with the 105mm gun and coax MG.
- Pickups in order (with some alternate routes): `hatch_scout` → `mortar` → `dozer_blade`, plus 2 `armor_plate` and 1 `ammo_rack`.
- 2–3 repair depots. The level uses elevation with normal ramps, and one `steep_ramp` route is visible but locked until Mk3.
- Enemies: `rifle_squad`, `technical`, `bunker_mg`, `atgm_team`, `light_tank`.
- Boss `boss_desert`, which rewards **Mk3** (new sprite, 120mm, `suspension`). The slice ends after the player uses the steep ramp to reach a final radio message.
- Features: map screen, HUD, pause, save slots, English and Hebrew, all three input schemes, debug overlay.
