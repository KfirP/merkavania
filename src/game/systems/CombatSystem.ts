import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import { damageMaterial, resolveHit } from '../../logic/combat/damage';
import { canHit, type Owner } from '../../logic/combat/faction';
import { applyDamage } from '../../logic/combat/health';
import { splashFalloff } from '../../logic/combat/splash';
import type { Damageable } from '../entities/Damageable';
import { Projectile } from '../entities/Projectile';
import { events } from '../events';
import type { EffectsSystem } from './EffectsSystem';
import type { ProjectileSystem } from './ProjectileSystem';

type Target = Damageable & Phaser.GameObjects.GameObject;

/** Something hits only toggle, never hurt (switches): told about every hit on its level. */
export interface Trigger extends Phaser.GameObjects.GameObject {
  readonly level: number;
  readonly pos: { x: number; y: number };
  hitBy(weapon: WeaponDef, owner: Owner): void;
}

/** A blast: a splash projectile's impact or a landing mortar shell. */
export interface Blast {
  x: number;
  y: number;
  level: number;
  owner: Owner;
  weapon: WeaponDef;
  depth: number;
}

/** Extra reach of a blast onto a trigger, px (the switch's own size). */
const TRIGGER_REACH = 6;

interface HitInfo {
  weapon: WeaponDef;
  rear: boolean;
  ricochet: boolean;
  splash: boolean;
}

/**
 * Resolves projectile hits on targets (docs/ARCHITECTURE.md, Combat flow): a projectile overlaps a
 * target of another faction on its level → `logic/combat` works out the damage → the target's HP
 * changes, events go out and effects play. Splash weapons also hurt everything nearby on that level.
 */
export class CombatSystem {
  /** Everything that can be hit (for splash); entities are added as they spawn. */
  private readonly targets = new Set<Target>();
  private readonly triggers = new Set<Trigger>();
  /** Debug: the player takes no damage. */
  god = false;
  /** Target of the direct hit being resolved, so its splash doesn't hit it twice. */
  private direct: Target | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly projectiles: ProjectileSystem,
    private readonly effects: EffectsSystem,
  ) {
    projectiles.onImpact = (p) => this.impact(p);
  }

  /**
   * Lets projectiles hit a target, or every member of a physics group of targets. Arcade can't
   * overlap against a plain Group (it has no collision category), so each physics object or
   * physics group that holds targets is watched once.
   */
  watch(
    targets: Target | Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup,
  ): Phaser.Physics.Arcade.Collider {
    // Arcade swaps the pair for a group against a single sprite, so sort them out by type.
    const pair = (a: unknown, b: unknown) =>
      (a instanceof Projectile ? [a, b] : [b, a]) as [Projectile, Target];
    return this.scene.physics.add.overlap(
      this.projectiles.group,
      targets,
      (a, b) => this.directHit(...pair(a, b)),
      (a, b) => {
        const [shot, target] = pair(a, b);
        return shot.active && target.alive && canHit(shot, target);
      },
    );
  }

  /** Registers a target for splash damage; it leaves again when destroyed. */
  add(target: Target): void {
    this.targets.add(target);
    target.once(Phaser.GameObjects.Events.DESTROY, () => this.targets.delete(target));
  }

  /** Lets projectiles and blasts on its level reach a trigger; it leaves again when destroyed. */
  addTrigger(trigger: Trigger): void {
    this.triggers.add(trigger);
    trigger.once(Phaser.GameObjects.Events.DESTROY, () => this.triggers.delete(trigger));
  }

  /** Projectiles stop on the triggers in a physics group (same level) and tell them who hit. */
  watchTriggers(group: Phaser.Physics.Arcade.StaticGroup): Phaser.Physics.Arcade.Collider {
    const pair = (a: unknown, b: unknown) =>
      (a instanceof Projectile ? [a, b] : [b, a]) as [Projectile, Trigger];
    return this.scene.physics.add.overlap(
      this.projectiles.group,
      group,
      (a, b) => {
        const [shot, trigger] = pair(a, b);
        if (!shot.active) return;
        trigger.hitBy(shot.weapon, shot.owner);
        this.projectiles.impact(shot);
      },
      (a, b) => {
        const [shot, trigger] = pair(a, b);
        return shot.active && shot.level === trigger.level;
      },
    );
  }

  /** Damage from outside a weapon (hazard terrain, debug); ignores armor. */
  damage(target: Damageable, amount: number): void {
    this.apply(target, amount);
  }

  private directHit(p: Projectile, target: Target): void {
    if (!p.active) return; // already spent on another target this step
    const { damage, rear, ricochet } = this.resolve(p.weapon, target, p.angleOfTravel);
    if (ricochet) this.effects.ricochet(p.x, p.y, p.depth, p.angleOfTravel);
    else this.effects.flash(target.flashTargets);
    this.apply(target, damage, { weapon: p.weapon, rear, ricochet, splash: false });
    this.direct = target;
    this.projectiles.impact(p);
    this.direct = null;
  }

  /** Every impact (target, wall, cliff): the blast and its splash damage. */
  private impact(p: Projectile): void {
    if ((p.weapon.splash ?? 0) <= 0) {
      if (!this.direct) this.effects.puff(p.x, p.y, p.depth);
      return;
    }
    const { x, y, level, owner, weapon, depth } = p;
    this.explode({ x, y, level, owner, weapon, depth });
  }

  /**
   * An explosion: effects, splash damage with falloff to every other-side target on its level,
   * and a hit on every trigger in reach there.
   */
  explode(b: Blast): void {
    const radius = b.weapon.splash ?? 0;
    this.effects.explosion(b.x, b.y, radius, b.depth);
    for (const t of [...this.targets]) {
      if (t === this.direct || !t.alive || !canHit(b, t)) continue;
      const falloff = splashFalloff(
        Phaser.Math.Distance.Between(b.x, b.y, t.pos.x, t.pos.y),
        radius,
      );
      if (falloff <= 0) continue;
      const angle = Phaser.Math.Angle.Between(b.x, b.y, t.pos.x, t.pos.y);
      const hit = this.resolve(b.weapon, t, angle);
      this.apply(t, hit.damage * falloff, { ...hit, weapon: b.weapon, splash: true });
    }
    for (const t of [...this.triggers]) {
      const d = Phaser.Math.Distance.Between(b.x, b.y, t.pos.x, t.pos.y);
      if (t.level === b.level && d <= radius + TRIGGER_REACH) t.hitBy(b.weapon, b.owner);
    }
  }

  private resolve(weapon: WeaponDef, target: Damageable, angle: number) {
    const d = target.defense;
    if ('material' in d) return { ...damageMaterial(weapon, d.material), rear: false };
    return resolveHit(weapon, d, angle);
  }

  private apply(target: Damageable, amount: number, hit?: HitInfo): void {
    if (!target.alive) return;
    const damage = target.faction === 'player' && this.god ? 0 : amount;
    const result = applyDamage(target.hp, damage);
    target.hp = result.hp;
    if (damage > 0)
      events.emit('hp:changed', { target: target.combatId, hp: target.hp, max: target.maxHp });
    if (hit)
      events.emit('combat:hit', {
        target: target.combatId,
        weapon: hit.weapon.id,
        damage,
        rear: hit.rear,
        ricochet: hit.ricochet,
        killed: result.killed,
        splash: hit.splash,
      });
    if (target.faction === 'player' && hit && damage > 0) this.effects.playerHit(damage);
    if (result.killed) target.die();
  }
}
