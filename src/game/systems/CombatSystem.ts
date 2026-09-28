import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import { damageMaterial, resolveHit } from '../../logic/combat/damage';
import { canHit } from '../../logic/combat/faction';
import { applyDamage } from '../../logic/combat/health';
import { splashFalloff } from '../../logic/combat/splash';
import type { Damageable } from '../entities/Damageable';
import { Projectile } from '../entities/Projectile';
import { events } from '../events';
import type { EffectsSystem } from './EffectsSystem';
import type { ProjectileSystem } from './ProjectileSystem';

type Target = Damageable & Phaser.GameObjects.GameObject;

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
  /** Everything that can be hit; entities add themselves when they spawn. */
  readonly targets: Phaser.GameObjects.Group;
  /** Debug: the player takes no damage. */
  god = false;
  /** Target of the direct hit being resolved, so its splash doesn't hit it twice. */
  private direct: Target | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly projectiles: ProjectileSystem,
    private readonly effects: EffectsSystem,
  ) {
    this.targets = scene.add.group();
    scene.physics.add.overlap(
      projectiles.group,
      this.targets,
      (p, t) => this.directHit(p as Projectile, t as Target),
      (p, t) => {
        const shot = p as Projectile;
        const target = t as Target;
        return shot.active && target.alive && canHit(shot, target);
      },
    );
    projectiles.onImpact = (p) => this.impact(p);
  }

  add(target: Target): void {
    this.targets.add(target);
  }

  remove(target: Target): void {
    this.targets.remove(target);
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
    const radius = p.weapon.splash ?? 0;
    if (radius <= 0) {
      if (!this.direct) this.effects.puff(p.x, p.y, p.depth);
      return;
    }
    this.effects.explosion(p.x, p.y, radius, p.depth);
    for (const t of this.targets.getChildren() as Target[]) {
      if (t === this.direct || !t.alive || !canHit(p, t)) continue;
      const falloff = splashFalloff(
        Phaser.Math.Distance.Between(p.x, p.y, t.pos.x, t.pos.y),
        radius,
      );
      if (falloff <= 0) continue;
      const angle = Phaser.Math.Angle.Between(p.x, p.y, t.pos.x, t.pos.y);
      const hit = this.resolve(p.weapon, t, angle);
      this.apply(t, hit.damage * falloff, { ...hit, weapon: p.weapon, splash: true });
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
