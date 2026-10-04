import Phaser from 'phaser';
import { bosses as bossDefs, isBossId, type BossDef } from '../../data/bosses';
import { allMkTierIds, type MkTierId } from '../../data/mkTiers';
import { depthFor } from '../../logic/world/depth';
import { parseChunkObjects, type BossSpec, type RawObject } from '../../logic/world/objects';
import { levelAt, type CellLookup } from '../../logic/world/traversal';
import type { WorldChunk } from '../../logic/world/world';
import { Boss } from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import { MkUpgrade } from '../entities/MkUpgrade';
import { events, type BossTelemetry } from '../events';
import type { CombatSystem } from './CombatSystem';
import type { EffectsSystem } from './EffectsSystem';
import type { ProgressionSystem } from './ProgressionSystem';
import type { ProjectileSystem } from './ProjectileSystem';
import type { RadioSystem } from './RadioSystem';
import type { SpawnSystem } from './SpawnSystem';

/** Camera pan to a waking boss and the hold before it returns, ms. */
const PAN_MS = 600;
const HOLD_MS = 900;
/** Explosions in a boss's death chain, and the time between them, ms. */
const DEATH_BLASTS = 6;
const DEATH_STEP_MS = 160;

export interface BossDeps {
  combat: CombatSystem;
  effects: EffectsSystem;
  projectiles: ProjectileSystem;
  progression: ProgressionSystem;
  radio: RadioSystem;
  spawner: SpawnSystem;
  cellAt: CellLookup;
  /** The tank drove onto a boss's upgrade crate. */
  upgrade(tier: MkTierId): void;
  /** Point the camera back at the active pawn after a pan. */
  refollow(): void;
}

/**
 * Bosses (data/bosses.ts) and the upgrades they leave. A boss wakes when the active pawn enters its
 * `boss_arena` zone (camera pan, radio), fights through logic/enemy/bossBrain.ts, and resets if the
 * player dies. Beaten, it's remembered in the save and leaves an `mk_upgrade` crate, which comes
 * back with its chunk until the tank has that tier.
 */
export class BossSystem {
  readonly bosses: Phaser.Physics.Arcade.StaticGroup;
  readonly upgrades: Phaser.Physics.Arcade.StaticGroup;
  private readonly byChunk = new Map<string, Phaser.GameObjects.GameObject[]>();
  private helpers: Enemy[] = [];
  private lastState = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: BossDeps,
  ) {
    this.bosses = scene.physics.add.staticGroup();
    this.upgrades = scene.physics.add.staticGroup();
  }

  onLoad(chunk: WorldChunk, raw: readonly RawObject[]): void {
    const spawned: Phaser.GameObjects.GameObject[] = [];
    for (const spec of parseChunkObjects(chunk, raw).bosses) {
      if (!isBossId(spec.bossType)) continue;
      const def = bossDefs[spec.bossType];
      const level = levelAt(spec.x, spec.y, this.deps.cellAt);
      if (this.deps.progression.state.flags.has(spec.key)) {
        if (this.needs(def.reward.tier)) spawned.push(this.dropUpgrade(spec, def, level));
        continue;
      }
      const boss = new Boss(this.scene, spec, def, level, (b) => this.defeated(b));
      this.bosses.add(boss);
      this.deps.combat.add(boss);
      spawned.push(boss);
    }
    this.byChunk.set(chunk.id, spawned);
  }

  onUnload(chunk: WorldChunk): void {
    for (const o of this.byChunk.get(chunk.id) ?? []) if (o.active) o.destroy();
    this.byChunk.delete(chunk.id);
  }

  destroy(): void {
    for (const id of [...this.byChunk.keys()]) this.onUnload({ id } as WorldChunk);
  }

  /** Bodies on the same level only: the bunker stops the tank, the scout and enemies. */
  addColliders(movers: Phaser.Types.Physics.Arcade.ArcadeColliderType[]): void {
    const sameLevel = (a: unknown, b: unknown) =>
      (a as { level: number }).level === (b as { level: number }).level;
    for (const m of movers) this.scene.physics.add.collider(m, this.bosses, undefined, sameLevel);
    this.deps.combat.watch(this.bosses);
  }

  /** One frame: `pawn` is the active pawn (whose position wakes and aims the boss). */
  update(dt: number, pawn: { pos: { x: number; y: number }; alive: boolean }): void {
    this.helpers = this.helpers.filter((e) => e.active && e.alive);
    for (const boss of this.living()) {
      const arena = boss.spec.arena;
      const inArena =
        pawn.alive &&
        !!arena &&
        Math.abs(pawn.pos.x - arena.x) <= arena.width / 2 &&
        Math.abs(pawn.pos.y - arena.y) <= arena.height / 2;
      const intent = boss.step(
        {
          hpShare: boss.hp / boss.maxHp,
          target: inArena ? pawn.pos : null,
          inArena,
          reinforcementsAlive: this.helpers.length,
        },
        dt,
        this.deps.projectiles,
      );
      if (intent.woke) this.wake(boss);
      if (intent.spawn) this.reinforce(boss);
    }
    this.emitState();
  }

  /** The player respawned: a boss mid-fight goes back to sleep at full health. */
  reset(): void {
    for (const boss of this.living()) boss.reset();
    this.helpers = [];
  }

  /** The tank drove onto an upgrade crate. */
  collect(crate: MkUpgrade): void {
    if (!crate.active) return;
    const { tier, radioKey } = crate;
    crate.destroy();
    this.deps.upgrade(tier);
    this.deps.radio.play(radioKey);
  }

  /** Debug: damage every living boss, ignoring armor. */
  damageAll(amount: number): void {
    for (const boss of this.living()) this.deps.combat.damage(boss, amount);
  }

  telemetry(): BossTelemetry | null {
    const boss = this.living()[0];
    const crate = this.upgrades.getChildren()[0] as MkUpgrade | undefined;
    const upgrade = crate ? { x: crate.x, y: crate.y, tier: crate.tier } : null;
    if (!boss) return upgrade ? { boss: null, upgrade } : null;
    return {
      boss: {
        key: boss.spec.key,
        bossType: boss.def.id,
        mode: boss.brain.mode,
        phase: boss.brain.phase,
        hp: boss.hp,
        maxHp: boss.maxHp,
        x: boss.x,
        y: boss.y,
        gun: boss.gunPos,
        telegraphing: boss.brain.telegraphing,
        shots: boss.shots,
        helpers: this.helpers.length,
      },
      upgrade,
    };
  }

  private living(): Boss[] {
    return (this.bosses.getChildren() as Boss[]).filter((b) => b.alive);
  }

  /** The tank doesn't have this tier yet. */
  private needs(tier: MkTierId): boolean {
    const mk = this.deps.progression.state.mk;
    return allMkTierIds.indexOf(tier) > allMkTierIds.indexOf(mk);
  }

  private wake(boss: Boss): void {
    this.deps.radio.play(boss.def.radio.intro);
    const cam = this.scene.cameras.main;
    cam.stopFollow();
    cam.pan(boss.x, boss.y, PAN_MS, 'Sine.easeInOut');
    this.scene.time.delayedCall(PAN_MS + HOLD_MS, () => this.deps.refollow());
  }

  private reinforce(boss: Boss): void {
    const { enemy } = boss.def.phase2.reinforcements;
    // Out of the bunker's side doors, alternating.
    const side = this.helpers.length % 2 === 0 ? -1 : 1;
    const x = boss.x + side * (boss.halfExtent.w + 12);
    const y = boss.y + boss.halfExtent.h;
    this.helpers.push(...this.deps.spawner.spawnReinforcement(enemy, x, y, Math.PI / 2));
  }

  private defeated(boss: Boss): void {
    const { spec, def } = boss;
    this.deps.progression.beatBoss(spec.key);
    const { effects } = this.deps;
    const depth = depthFor(boss.level, spec.y) + 1;
    for (let i = 0; i < DEATH_BLASTS; i++)
      this.scene.time.delayedCall(i * DEATH_STEP_MS, () => {
        const x = spec.x + Phaser.Math.Between(-boss.halfExtent.w, boss.halfExtent.w);
        const y = spec.y + Phaser.Math.Between(-boss.halfExtent.h, boss.halfExtent.h);
        effects.explosion(x, y, def.blast, depth);
        this.scene.cameras.main.shake(140, 0.006);
      });
    for (const e of this.helpers) if (e.alive) this.deps.combat.damage(e, e.hp);
    this.helpers = [];
    this.deps.radio.play(def.radio.defeated);
    events.emit('boss:defeated', { key: spec.key, bossType: def.id });
    const crate = this.dropUpgrade(spec, def, boss.level);
    const chunkId = spec.key.slice(0, spec.key.indexOf(':'));
    this.byChunk.get(chunkId)?.push(crate);
  }

  private dropUpgrade(spec: BossSpec, def: BossDef, level: number): MkUpgrade {
    const crate = new MkUpgrade(
      this.scene,
      spec.x,
      spec.y,
      def.reward.tier,
      level,
      def.radio.reward,
    );
    this.upgrades.add(crate);
    return crate;
  }

  /** The HUD's boss bar: shown while a boss is awake. */
  private emitState(): void {
    const boss = this.living().find((b) => b.brain.mode === 'intro' || b.brain.mode === 'fight');
    const state = boss
      ? { active: true, bossType: boss.def.id, hp: Math.ceil(boss.hp), max: boss.maxHp }
      : { active: false, bossType: '', hp: 0, max: 0 };
    const key = JSON.stringify(state);
    if (key === this.lastState) return;
    this.lastState = key;
    events.emit('boss:state', state);
  }
}
