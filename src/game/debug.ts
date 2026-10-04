import type Phaser from 'phaser';
import type { AbilityId } from '../data/abilities';
import { slotKey, type SaveData } from '../logic/save/save';
import {
  events,
  type CombatHit,
  type EntitiesTelemetry,
  type GameEvents,
  type ObjectsTelemetry,
  type PawnTelemetry,
  type WorldState,
} from './events';
import { touchButtonIds, type TouchButtonId } from '../logic/input/touchButtons';
import type { MapView } from '../logic/world/mapScreen';
import type { TouchControlsScene } from './scenes/TouchControlsScene';
import type { HudScene, HudSnapshot } from './scenes/HudScene';
import { openMapView } from './scenes/MapScene';
import { menuSnapshot, type MenuSnapshot } from './ui/Menu';

export function isDebug(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

/** Hits kept for `getCombatLog`. */
const COMBAT_LOG_SIZE = 100;

export interface DebugHooks {
  game: Phaser.Game;
  /** The active pawn (the tank, or the scout while it's out) as of the last frame. */
  getPawn(): PawnTelemetry | null;
  /** The tank as of the last frame, whichever pawn is active. */
  getTank(): PawnTelemetry | null;
  /** Presses the rear hatch: deploys the scout, or recalls it. */
  pressHatch(): void;
  /** Deals `amount` damage to the scout (if it's out), ignoring armor. */
  damageScout(amount: number): void;
  /** Shots fired per weapon id since boot. */
  getShots(): Record<string, number>;
  /** Current and loaded chunks, or null before WorldScene streams any. */
  getWorld(): WorldState | null;
  /** Moves the active pawn to world (x, y) and stops it, optionally facing `heading` (radians). */
  teleport(x: number, y: number, heading?: number): void;
  /** Deals `amount` damage to the player, ignoring armor. */
  damagePlayer(amount: number): void;
  /** The player takes no damage while on. */
  setGod(on: boolean): void;
  /** The most recent resolved hits, oldest first. */
  getCombatLog(): CombatHit[];
  /**
   * Where world point (x, y) is on the canvas, as fractions (0..1) of its size, per the World
   * scene's camera. Specs use it to aim with the mouse.
   */
  worldToCanvas(x: number, y: number): { fx: number; fy: number };
  /** Live destructibles as of the last frame. */
  getDestructibles(): EntitiesTelemetry['destructibles'];
  /** Live enemies as of the last frame. */
  getEnemies(): EntitiesTelemetry['enemies'];
  /** Spawns an enemy (a whole squad for `rifle_squad`) at world (x, y), facing `facing` rad. */
  spawnEnemy(type: string, x: number, y: number, facing?: number): void;
  /** The GameState as of the last frame, in save shape; null before WorldScene runs. */
  getState(): SaveData | null;
  /** Gives the tank an ability without its pickup. */
  grantAbility(ability: AbilityId): void;
  /** What's stored in save slot `slot` (parsed), or null. */
  getSave(slot: number): unknown;
  /** Empties save slot `slot`. */
  clearSave(slot: number): void;
  /** Pickups, switches, doors, depots and boulders in the loaded chunks, as of the last frame. */
  getObjects(): ObjectsTelemetry;
  /** Where mortar shells came down since boot, oldest first. */
  getMortarLandings(): GameEvents['mortar:landed'][];
  /** Ids of the touch buttons on screen, or null without touch controls. */
  getTouchButtons(): TouchButtonId[] | null;
  /** The open map screen's layout, or null while it's closed. */
  getMapView(): MapView | null;
  /** What the HUD shows, or null while it isn't running. */
  getHud(): HudSnapshot | null;
  /** The menu open in scene `scene` (Title, Pause, Settings), or null. */
  getMenu(scene: string): MenuSnapshot | null;
}

declare global {
  interface Window {
    __merkavania?: DebugHooks;
  }
}

/** Exposes hooks for Playwright and the console. Debug builds only. */
export function installDebugHooks(game: Phaser.Game): void {
  if (!isDebug()) return;
  let pawn: PawnTelemetry | null = null;
  let tank: PawnTelemetry | null = null;
  let world: WorldState | null = null;
  const shots: Record<string, number> = {};
  const hits: CombatHit[] = [];
  let entities: EntitiesTelemetry = { destructibles: [], enemies: [] };
  let objects: ObjectsTelemetry = {
    pickups: [],
    switches: [],
    doors: [],
    depots: [],
    boulders: [],
  };
  let state: SaveData | null = null;
  const landings: GameEvents['mortar:landed'][] = [];
  events.on('debug:objects', (o) => (objects = o));
  events.on('debug:state', (s) => (state = s));
  events.on('mortar:landed', (l) => landings.push(l));
  events.on('debug:entities', (e) => (entities = e));
  events.on('debug:pawn', (p) => (pawn = p));
  events.on('debug:tank', (t) => (tank = t));
  events.on('world:chunks', (w) => (world = w));
  events.on('weapon:fired', ({ weapon }) => (shots[weapon] = (shots[weapon] ?? 0) + 1));
  events.on('combat:hit', (hit) => {
    hits.push(hit);
    if (hits.length > COMBAT_LOG_SIZE) hits.shift();
  });
  window.__merkavania = {
    game,
    getPawn: () => pawn,
    getTank: () => tank,
    pressHatch: () => events.emit('debug:hatch', undefined),
    damageScout: (amount) => events.emit('debug:damageScout', { amount }),
    getShots: () => ({ ...shots }),
    getWorld: () => world && { chunk: world.chunk, loaded: [...world.loaded] },
    teleport: (x, y, heading) => events.emit('debug:teleport', { x, y, heading }),
    damagePlayer: (amount) => events.emit('debug:damagePlayer', { amount }),
    setGod: (on) => events.emit('debug:god', { on }),
    getCombatLog: () => hits.map((h) => ({ ...h })),
    worldToCanvas: (x, y) => {
      const cam = game.scene.getScene('World').cameras.main;
      return { fx: (x - cam.worldView.x) / cam.width, fy: (y - cam.worldView.y) / cam.height };
    },
    getDestructibles: () => entities.destructibles.map((d) => ({ ...d })),
    getEnemies: () => entities.enemies.map((e) => ({ ...e })),
    spawnEnemy: (type, x, y, facing = 0) => events.emit('debug:spawnEnemy', { type, x, y, facing }),
    getState: () => state && (JSON.parse(JSON.stringify(state)) as SaveData),
    grantAbility: (ability) => events.emit('debug:grantAbility', { ability }),
    getSave: (slot) => {
      const raw = window.localStorage.getItem(slotKey(slot));
      return raw === null ? null : (JSON.parse(raw) as unknown);
    },
    clearSave: (slot) => window.localStorage.removeItem(slotKey(slot)),
    getObjects: () => JSON.parse(JSON.stringify(objects)) as ObjectsTelemetry,
    getMortarLandings: () => landings.map((l) => ({ ...l })),
    getMenu: (scene) => menuSnapshot(scene),
    getMapView: () => openMapView(),
    getTouchButtons: () => {
      if (!game.scene.isActive('TouchControls')) return null;
      const scene = game.scene.getScene('TouchControls') as TouchControlsScene;
      return touchButtonIds.filter((id) => scene.isShown(id));
    },
    getHud: () =>
      game.scene.isActive('Hud') ? (game.scene.getScene('Hud') as HudScene).snapshot() : null,
  };
}
